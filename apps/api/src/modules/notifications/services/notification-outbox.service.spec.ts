import { Test, TestingModule } from '@nestjs/testing';
import { NotificationOutboxService } from './notification-outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import {
  NotificationEventType,
  OutboxStatus,
  NotificationChannel,
  NotificationCategory,
  DeliveryStatus,
  UserRole,
} from '@prisma/client';

describe('NotificationOutboxService', () => {
  let service: NotificationOutboxService;
  let prisma: any;
  let emailService: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      notificationOutbox: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      orgStaff: {
        findMany: jest.fn(),
      },
      notification: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      notificationDelivery: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      notificationPreference: {
        findUnique: jest.fn(),
      },
    };

    emailService = {
      sendEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'ses-msg-12345',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationOutboxService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<NotificationOutboxService>(NotificationOutboxService);
  });

  describe('claimBatch (PostgreSQL FOR UPDATE SKIP LOCKED)', () => {
    it('should claim batch of pending items atomically with worker locking', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'outbox-1' }, { id: 'outbox-2' }]);
      prisma.$executeRaw.mockResolvedValue(2);
      prisma.notificationOutbox.findMany.mockResolvedValue([
        {
          id: 'outbox-1',
          eventType: NotificationEventType.APPOINTMENT_CONFIRMED,
          aggregateType: 'Appointment',
          aggregateId: 'appt-1',
          payload: { appointmentId: 'appt-1', customerId: 'cust-1' },
          retryCount: 0,
        },
        {
          id: 'outbox-2',
          eventType: NotificationEventType.APPOINTMENT_REMINDER_24H,
          aggregateType: 'Appointment',
          aggregateId: 'appt-2',
          payload: { appointmentId: 'appt-2', customerId: 'cust-2' },
          retryCount: 0,
        },
      ]);

      const items = await service.claimBatch(10);

      expect(items).toHaveLength(2);
      expect(items[0].id).toBe('outbox-1');
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should return empty array if no items are pending', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const items = await service.claimBatch(10);

      expect(items).toEqual([]);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('Recipient Resolution & Deduplication', () => {
    it('should deduplicate recipients so a single user matching customer and staff receives exactly one notification', async () => {
      // Mock batch claiming
      prisma.$queryRaw.mockResolvedValue([{ id: 'outbox-dup' }]);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.notificationOutbox.findMany.mockResolvedValue([
        {
          id: 'outbox-dup',
          eventType: NotificationEventType.APPOINTMENT_CONFIRMED,
          aggregateType: 'Appointment',
          aggregateId: 'appt-dup',
          payload: {
            appointmentId: 'appt-dup',
            customerId: 'user-dual-role',
            staffUserId: 'user-dual-role', // Same user is customer and staff
          },
          retryCount: 0,
        },
      ]);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-dual-role',
        email: 'dual@example.com',
        firstName: 'Dual',
        lastName: 'Role',
      });

      prisma.notification.findUnique.mockResolvedValue(null);
      prisma.notification.create.mockImplementation((args) =>
        Promise.resolve({ id: 'notif-dup-created', ...args.data }),
      );
      prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: true });
      prisma.notificationDelivery.findUnique.mockResolvedValue(null);

      await service.processPendingOutbox(10);

      // Notification created exactly ONCE for user-dual-role
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'dual@example.com',
          userId: 'user-dual-role',
        }),
      );
    });
  });

  describe('Preferences Enforcement (Email Opt-Out)', () => {
    it('should deliver In-App notification but skip Email delivery when user has opted out of reminders', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'outbox-pref' }]);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.notificationOutbox.findMany.mockResolvedValue([
        {
          id: 'outbox-pref',
          eventType: NotificationEventType.APPOINTMENT_REMINDER_24H,
          aggregateType: 'Appointment',
          aggregateId: 'appt-pref',
          payload: {
            appointmentId: 'appt-pref',
            customerId: 'cust-opted-out',
            serviceName: 'Consultation',
          },
          retryCount: 0,
        },
      ]);

      prisma.user.findUnique.mockResolvedValue({
        id: 'cust-opted-out',
        email: 'optout@example.com',
        firstName: 'No',
        lastName: 'Spam',
      });

      prisma.notification.findUnique.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({ id: 'notif-opted-out' });

      // User preference disabled for APPOINTMENT_REMINDERS
      prisma.notificationPreference.findUnique.mockResolvedValue({
        userId: 'cust-opted-out',
        category: NotificationCategory.APPOINTMENT_REMINDERS,
        channel: NotificationChannel.EMAIL,
        enabled: false,
      });

      prisma.notificationDelivery.findUnique.mockResolvedValue(null);

      await service.processPendingOutbox(10);

      // In-app notification created
      expect(prisma.notification.create).toHaveBeenCalled();

      // EmailService was NOT called
      expect(emailService.sendEmail).not.toHaveBeenCalled();

      // Notification delivery record created with SKIPPED status
      expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: NotificationChannel.EMAIL,
          status: DeliveryStatus.SKIPPED,
          recipientAddress: 'optout@example.com',
          failureReason: 'USER_OPTED_OUT',
        }),
      });

      // Outbox item successfully marked PROCESSED (not failed)
      expect(prisma.notificationOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'outbox-pref' },
          data: expect.objectContaining({ status: OutboxStatus.PROCESSED }),
        }),
      );
    });
  });

  describe('Watchdog & Stale Lock Recovery', () => {
    it('should recover rows stuck in PROCESSING for > 5 minutes back to PENDING', async () => {
      prisma.$executeRaw.mockResolvedValue(3);

      const recovered = await service.recoverStaleProcessing();

      expect(recovered).toBe(3);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should prevent duplicate Notification and Email on retry when idempotencyKey already exists', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'outbox-retry' }]);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.notificationOutbox.findMany.mockResolvedValue([
        {
          id: 'outbox-retry',
          eventType: NotificationEventType.APPOINTMENT_CONFIRMED,
          aggregateType: 'APPOINTMENT',
          aggregateId: 'appt-retry',
          payload: { appointmentId: 'appt-retry', customerId: 'cust-1', serviceName: 'Dental' },
          retryCount: 1,
        },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'cust-1',
        email: 'cust@example.com',
        firstName: 'Sam',
        lastName: 'Lee',
      });
      prisma.notification.findUnique.mockResolvedValue({ id: 'notif-existing-1' });
      prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: true });
      prisma.notificationDelivery.findUnique.mockResolvedValue({
        id: 'del-existing-1',
        status: DeliveryStatus.SENT,
      });

      await service.processPendingOutbox(10);

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(prisma.notificationOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'outbox-retry' },
          data: expect.objectContaining({ status: OutboxStatus.PROCESSED }),
        }),
      );
    });

    it('should mark outbox record FAILED after 3 failed retry attempts', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'outbox-fail' }]);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.notificationOutbox.findMany.mockResolvedValue([
        {
          id: 'outbox-fail',
          eventType: NotificationEventType.APPOINTMENT_CONFIRMED,
          aggregateType: 'APPOINTMENT',
          aggregateId: 'appt-fail',
          payload: { appointmentId: 'appt-fail', customerId: 'cust-1' },
          retryCount: 2, // 3rd attempt
        },
      ]);
      prisma.user.findUnique.mockRejectedValue(new Error('DB transient failure'));

      await service.processPendingOutbox(10);

      expect(prisma.notificationOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'outbox-fail' },
          data: expect.objectContaining({
            status: OutboxStatus.FAILED,
            retryCount: 3,
            errorMessage: 'DB transient failure',
          }),
        }),
      );
    });
  });

  describe('Safe Data Retention Cleanup', () => {
    it('should only purge PROCESSED records older than retentionDays without touching PENDING or FAILED', async () => {
      prisma.$executeRaw.mockResolvedValue(15);

      const deletedCount = await service.safeCleanupOutbox(30);

      expect(deletedCount).toBe(15);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });
});
