import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { EmailTemplateService } from './services/email-template.service';
import { EmailLogService } from './services/email-log.service';
import { NodemailerProvider } from './providers/nodemailer.provider';
import { PrismaService } from '../prisma/prisma.service';
import { EmailEvent, EMAIL_QUEUE_NAME } from './constants/email.constants';
import { EmailNotificationStatus } from '@prisma/client';

describe('EmailService', () => {
  let service: EmailService;
  let prisma: any;
  let logService: any;
  let mailerProvider: any;
  let emailQueue: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    logService = {
      findByIdempotencyKey: jest.fn().mockResolvedValue(null),
      createLog: jest.fn().mockImplementation((params) =>
        Promise.resolve({
          id: 'log-123',
          ...params,
          status: params.status || EmailNotificationStatus.PENDING,
        }),
      ),
      updateSuccess: jest.fn().mockResolvedValue({ status: EmailNotificationStatus.SENT }),
      updateFailure: jest.fn().mockResolvedValue({ status: EmailNotificationStatus.FAILED }),
      updateSkipped: jest.fn().mockResolvedValue({ status: EmailNotificationStatus.SKIPPED }),
    };

    mailerProvider = {
      sendMail: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-456' }),
    };

    emailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-789' }),
      getJob: jest.fn().mockResolvedValue({ remove: jest.fn().mockResolvedValue(true) }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        EmailTemplateService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailLogService, useValue: logService },
        { provide: NodemailerProvider, useValue: mailerProvider },
        { provide: `BullQueue_${EMAIL_QUEUE_NAME}`, useValue: emailQueue },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  describe('Notification Preferences (canSendToUser)', () => {
    it('should always allow security events even if emailNotifications is false', async () => {
      prisma.user.findUnique.mockResolvedValue({ emailNotifications: false });

      expect(await service.canSendToUser('user-1', EmailEvent.AUTH_REGISTER_OTP)).toBe(true);
      expect(await service.canSendToUser('user-1', EmailEvent.AUTH_LOGIN_OTP)).toBe(true);
      expect(await service.canSendToUser('user-1', EmailEvent.AUTH_PASSWORD_RESET_OTP)).toBe(true);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should respect opt-out for transactional non-security events', async () => {
      prisma.user.findUnique.mockResolvedValue({ emailNotifications: false });

      const allowed = await service.canSendToUser('user-1', EmailEvent.ORDER_CONFIRMED);
      expect(allowed).toBe(false);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { emailNotifications: true },
      });
    });

    it('should allow non-security events when user is opted in', async () => {
      prisma.user.findUnique.mockResolvedValue({ emailNotifications: true });

      const allowed = await service.canSendToUser('user-1', EmailEvent.APPOINTMENT_CONFIRMED);
      expect(allowed).toBe(true);
    });

    it('should default to true if user is not found in database', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const allowed = await service.canSendToUser('user-unknown', EmailEvent.ORDER_PACKED);
      expect(allowed).toBe(true);
    });
  });

  describe('sendEmail (Synchronous dispatch)', () => {
    it('should successfully send email, create log, and update success', async () => {
      const result = await service.sendEmail({
        event: EmailEvent.ORDER_CONFIRMED,
        recipient: 'customer@example.com',
        variables: { order_number: 'ORD-999', customer_name: 'John Doe' },
        idempotencyKey: 'email_ord_999',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(EmailNotificationStatus.SENT);
      expect(logService.createLog).toHaveBeenCalled();
      expect(mailerProvider.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Your Jesmond order ORD-999 is confirmed',
        }),
      );
      expect(logService.updateSuccess).toHaveBeenCalledWith('log-123', {
        messageId: 'msg-456',
      });
    });

    it('should skip email when user has opted out', async () => {
      prisma.user.findUnique.mockResolvedValue({ emailNotifications: false });

      const result = await service.sendEmail({
        event: EmailEvent.ORDER_PACKED,
        recipient: 'customer@example.com',
        userId: 'user-opted-out',
        variables: { order_number: 'ORD-999' },
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('SKIPPED');
      expect(result.skippedReason).toBe('USER_OPTED_OUT');
      expect(mailerProvider.sendMail).not.toHaveBeenCalled();
    });

    it('should detect duplicate idempotency key and avoid resending', async () => {
      logService.findByIdempotencyKey.mockResolvedValue({
        id: 'log-existing',
        status: EmailNotificationStatus.SENT,
      });

      const result = await service.sendEmail({
        event: EmailEvent.ORDER_DELIVERED,
        recipient: 'customer@example.com',
        idempotencyKey: 'duplicate_key',
        variables: { order_number: 'ORD-999' },
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(EmailNotificationStatus.SENT);
      expect(mailerProvider.sendMail).not.toHaveBeenCalled();
    });

    it('should record failure when nodemailer fails to dispatch', async () => {
      mailerProvider.sendMail.mockResolvedValue({
        success: false,
        error: 'SMTP Connection timeout',
      });

      const result = await service.sendEmail({
        event: EmailEvent.ORDER_TAKEN_AWAY,
        recipient: 'customer@example.com',
        variables: { order_number: 'ORD-999' },
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(EmailNotificationStatus.FAILED);
      expect(result.error).toBe('SMTP Connection timeout');
      expect(logService.updateFailure).toHaveBeenCalledWith(
        'log-123',
        'SMTP Connection timeout',
        false,
      );
    });
  });

  describe('sendEmailAsync (Queue integration)', () => {
    it('should add job to BullMQ queue without blocking caller', async () => {
      const result = await service.sendEmailAsync({
        event: EmailEvent.PROPERTY_LISTING_CONFIRMED,
        recipient: 'manager@example.com',
        variables: { property_title: 'Sunny Flat' },
        idempotencyKey: 'prop_list_123',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(EmailNotificationStatus.QUEUED);
      expect(emailQueue.add).toHaveBeenCalled();
    });

    it('should support delayed reminder scheduling with delayMs', async () => {
      await service.sendEmailAsync({
        event: EmailEvent.APPOINTMENT_REMINDER,
        recipient: 'client@example.com',
        variables: {
          customer_name: 'Bob',
          service_name: 'Consultation',
          appointment_time: 'Tomorrow 10am',
        },
        idempotencyKey: 'reminder_123',
        delayMs: 3600000,
      });

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.anything(),
        expect.objectContaining({
          jobId: 'reminder_123',
          delay: 3600000,
        }),
      );
    });

    it('should cancel scheduled jobs when cancelScheduledJob is called', async () => {
      const cancelled = await service.cancelScheduledJob('reminder_123');
      expect(cancelled).toBe(true);
      expect(emailQueue.getJob).toHaveBeenCalledWith('reminder_123');
    });
  });

  describe('executeQueuedEmail (Appointment status verification)', () => {
    it('should send appointment reminder if appointment is still CONFIRMED', async () => {
      prisma.appointment = {
        findUnique: jest.fn().mockResolvedValue({ id: 'appt-1', status: 'CONFIRMED' }),
      };

      const result = await service.executeQueuedEmail({
        options: {
          event: EmailEvent.APPOINTMENT_REMINDER,
          recipient: 'customer@example.com',
          relatedEntityId: 'appt-1',
          variables: {
            customer_name: 'John',
            service_name: 'Haircut',
            appointment_time: 'Tomorrow 10am',
          },
        },
        logId: 'log-rem-1',
        attempt: 1,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(EmailNotificationStatus.SENT);
      expect(mailerProvider.sendMail).toHaveBeenCalled();
      expect(logService.updateSuccess).toHaveBeenCalled();
    });

    it('should skip appointment reminder if appointment was CANCELLED', async () => {
      prisma.appointment = {
        findUnique: jest.fn().mockResolvedValue({ id: 'appt-1', status: 'CANCELLED' }),
      };

      const result = await service.executeQueuedEmail({
        options: {
          event: EmailEvent.APPOINTMENT_REMINDER,
          recipient: 'customer@example.com',
          relatedEntityId: 'appt-1',
          variables: {
            customer_name: 'John',
            service_name: 'Haircut',
            appointment_time: 'Tomorrow 10am',
          },
        },
        logId: 'log-rem-1',
        attempt: 1,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(EmailNotificationStatus.SKIPPED);
      expect(result.skippedReason).toBe('APPOINTMENT_STATUS_CANCELLED');
      expect(mailerProvider.sendMail).not.toHaveBeenCalled();
      expect(logService.updateSkipped).toHaveBeenCalledWith(
        'log-rem-1',
        'Appointment not confirmed (status: CANCELLED)',
      );
    });

    it('should skip provider reminder if appointment was REJECTED', async () => {
      prisma.appointment = {
        findUnique: jest.fn().mockResolvedValue({ id: 'appt-1', status: 'REJECTED' }),
      };

      const result = await service.executeQueuedEmail({
        options: {
          event: EmailEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER,
          recipient: 'provider@example.com',
          relatedEntityId: 'appt-1',
          variables: {
            provider_name: 'Dr. Smith',
            service_name: 'Consultation',
            appointment_time: 'Tomorrow 10am',
          },
        },
        logId: 'log-sp-rem-1',
        attempt: 1,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(EmailNotificationStatus.SKIPPED);
      expect(result.skippedReason).toBe('APPOINTMENT_STATUS_REJECTED');
      expect(mailerProvider.sendMail).not.toHaveBeenCalled();
    });

    it('should safely skip if appointment is missing from database', async () => {
      prisma.appointment = {
        findUnique: jest.fn().mockResolvedValue(null),
      };

      const result = await service.executeQueuedEmail({
        options: {
          event: EmailEvent.APPOINTMENT_REMINDER,
          recipient: 'customer@example.com',
          relatedEntityId: 'appt-missing',
          variables: {
            customer_name: 'John',
            service_name: 'Haircut',
            appointment_time: 'Tomorrow 10am',
          },
        },
        logId: 'log-rem-missing',
        attempt: 1,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(EmailNotificationStatus.SKIPPED);
      expect(result.skippedReason).toBe('APPOINTMENT_NOT_FOUND');
      expect(mailerProvider.sendMail).not.toHaveBeenCalled();
    });

    it('should safely skip if reminder event has no relatedEntityId', async () => {
      const result = await service.executeQueuedEmail({
        options: {
          event: EmailEvent.APPOINTMENT_REMINDER,
          recipient: 'customer@example.com',
          variables: {
            customer_name: 'John',
            service_name: 'Haircut',
            appointment_time: 'Tomorrow 10am',
          },
        },
        logId: 'log-no-id',
        attempt: 1,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(EmailNotificationStatus.SKIPPED);
      expect(result.skippedReason).toBe('MISSING_APPOINTMENT_ID');
      expect(mailerProvider.sendMail).not.toHaveBeenCalled();
    });

    it('should bypass appointment status check for non-appointment events', async () => {
      prisma.appointment = {
        findUnique: jest.fn(),
      };

      const result = await service.executeQueuedEmail({
        options: {
          event: EmailEvent.ORDER_CONFIRMED,
          recipient: 'buyer@example.com',
          relatedEntityId: 'order-123',
          variables: { order_number: 'ORD-123', customer_name: 'Alice' },
        },
        logId: 'log-ord-1',
        attempt: 1,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(EmailNotificationStatus.SENT);
      expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
      expect(mailerProvider.sendMail).toHaveBeenCalled();
    });
  });
});

