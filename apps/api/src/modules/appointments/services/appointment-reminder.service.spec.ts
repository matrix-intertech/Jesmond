import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentReminderService } from './appointment-reminder.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AppointmentStatus,
  ReminderStatus,
  ReminderType,
  ReminderRecipientType,
  NotificationEventType,
  OutboxStatus,
} from '@prisma/client';

describe('AppointmentReminderService', () => {
  let service: AppointmentReminderService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      $queryRaw: jest.fn(),
      appointmentReminder: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notificationOutbox: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentReminderService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AppointmentReminderService>(AppointmentReminderService);
  });

  describe('processDueReminders', () => {
    it('should return empty summary when no reminders are claimable', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const summary = await service.processDueReminders(50);

      expect(summary.processed).toBe(0);
      expect(summary.sent).toBe(0);
      expect(prisma.appointmentReminder.findMany).not.toHaveBeenCalled();
    });

    it('should cancel reminder if appointment does not exist', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'rem-1' }]);
      prisma.appointmentReminder.findMany.mockResolvedValue([
        {
          id: 'rem-1',
          appointmentId: 'appt-1',
          appointment: null,
          scheduleVersion: 1,
          scheduledFor: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
        },
      ]);

      const summary = await service.processDueReminders(50);

      expect(summary.processed).toBe(1);
      expect(summary.cancelled).toBe(1);
      expect(prisma.appointmentReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rem-1' },
          data: expect.objectContaining({
            status: ReminderStatus.CANCELLED,
            cancellationReason: 'Appointment no longer exists',
          }),
        }),
      );
    });

    it('should cancel reminder if appointment is not CONFIRMED (e.g. CANCELLED or PENDING)', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'rem-2' }]);
      prisma.appointmentReminder.findMany.mockResolvedValue([
        {
          id: 'rem-2',
          appointmentId: 'appt-2',
          appointment: {
            id: 'appt-2',
            status: AppointmentStatus.CANCELLED,
            scheduleVersion: 1,
            startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          scheduleVersion: 1,
          scheduledFor: new Date(Date.now() - 5 * 60 * 1000),
        },
      ]);

      const summary = await service.processDueReminders(50);

      expect(summary.cancelled).toBe(1);
      expect(prisma.appointmentReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rem-2' },
          data: expect.objectContaining({
            status: ReminderStatus.CANCELLED,
            cancellationReason: expect.stringContaining('CANCELLED'),
          }),
        }),
      );
    });

    it('should cancel reminder if scheduleVersion is outdated (rescheduled appointment)', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'rem-3' }]);
      prisma.appointmentReminder.findMany.mockResolvedValue([
        {
          id: 'rem-3',
          appointmentId: 'appt-3',
          appointment: {
            id: 'appt-3',
            status: AppointmentStatus.CONFIRMED,
            scheduleVersion: 2, // Appointment is at version 2
            startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          scheduleVersion: 1, // Reminder was for version 1
          scheduledFor: new Date(Date.now() - 5 * 60 * 1000),
        },
      ]);

      const summary = await service.processDueReminders(50);

      expect(summary.cancelled).toBe(1);
      expect(prisma.appointmentReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rem-3' },
          data: expect.objectContaining({
            status: ReminderStatus.CANCELLED,
            cancellationReason: expect.stringContaining('Outdated schedule version'),
          }),
        }),
      );
    });

    it('should mark reminder MISSED if appointment already started (startTime <= NOW)', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'rem-4' }]);
      prisma.appointmentReminder.findMany.mockResolvedValue([
        {
          id: 'rem-4',
          appointmentId: 'appt-4',
          appointment: {
            id: 'appt-4',
            status: AppointmentStatus.CONFIRMED,
            scheduleVersion: 1,
            startTime: new Date(Date.now() - 10 * 60 * 1000), // Started 10 min ago
          },
          scheduleVersion: 1,
          scheduledFor: new Date(Date.now() - 70 * 60 * 1000), // Scheduled 70 min ago
        },
      ]);

      const summary = await service.processDueReminders(50);

      expect(summary.missed).toBe(1);
      expect(prisma.appointmentReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rem-4' },
          data: expect.objectContaining({
            status: ReminderStatus.MISSED,
            cancellationReason: 'Appointment has already commenced',
          }),
        }),
      );
    });

    it('should mark reminder MISSED if overdue past the 15-minute grace window', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'rem-5' }]);
      prisma.appointmentReminder.findMany.mockResolvedValue([
        {
          id: 'rem-5',
          appointmentId: 'appt-5',
          appointment: {
            id: 'appt-5',
            status: AppointmentStatus.CONFIRMED,
            scheduleVersion: 1,
            startTime: new Date(Date.now() + 60 * 60 * 1000), // In 1 hour
          },
          scheduleVersion: 1,
          scheduledFor: new Date(Date.now() - 25 * 60 * 1000), // Due 25 min ago (>15 min grace window)
        },
      ]);

      const summary = await service.processDueReminders(50);

      expect(summary.missed).toBe(1);
      expect(prisma.appointmentReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rem-5' },
          data: expect.objectContaining({
            status: ReminderStatus.MISSED,
            cancellationReason: expect.stringContaining('>15 minutes late'),
          }),
        }),
      );
    });

    it('should successfully dispatch outbox event and mark reminder SENT within grace window', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'rem-valid' }]);
      prisma.appointmentReminder.findMany.mockResolvedValue([
        {
          id: 'rem-valid',
          appointmentId: 'appt-valid',
          reminderType: ReminderType.BEFORE_24_HOURS,
          recipientType: ReminderRecipientType.CUSTOMER,
          recipientUserId: 'cust-1',
          scheduleVersion: 1,
          scheduledFor: new Date(Date.now() - 5 * 60 * 1000), // Due 5 min ago (within 15m grace window)
          appointment: {
            id: 'appt-valid',
            status: AppointmentStatus.CONFIRMED,
            scheduleVersion: 1,
            serviceName: 'Full Car Service',
            startTime: new Date(Date.now() + 23 * 60 * 60 * 1000),
            timezone: 'Australia/Sydney',
            customerId: 'cust-1',
            staff: { userId: 'staff-1' },
            branch: { organizationId: 'org-1' },
          },
        },
      ]);

      const summary = await service.processDueReminders(50);

      expect(summary.sent).toBe(1);
      expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: NotificationEventType.APPOINTMENT_REMINDER_24H,
          aggregateType: 'Appointment',
          aggregateId: 'appt-valid',
          status: OutboxStatus.PENDING,
          payload: expect.objectContaining({
            appointmentId: 'appt-valid',
            serviceName: 'Full Car Service',
            customerId: 'cust-1',
          }),
        }),
      });

      expect(prisma.appointmentReminder.update).toHaveBeenCalledWith({
        where: { id: 'rem-valid' },
        data: expect.objectContaining({
          status: ReminderStatus.SENT,
          sentAt: expect.any(Date),
        }),
      });
    });
  });

  describe('cancelRemindersForAppointment', () => {
    it('should bulk cancel all SCHEDULED reminders for an appointment', async () => {
      prisma.appointmentReminder.updateMany.mockResolvedValue({ count: 2 });

      const cancelledCount = await service.cancelRemindersForAppointment(
        'appt-cancel',
        'Customer cancelled',
      );

      expect(cancelledCount).toBe(2);
      expect(prisma.appointmentReminder.updateMany).toHaveBeenCalledWith({
        where: {
          appointmentId: 'appt-cancel',
          status: ReminderStatus.SCHEDULED,
        },
        data: expect.objectContaining({
          status: ReminderStatus.CANCELLED,
          cancellationReason: 'Customer cancelled',
        }),
      });
    });
  });
});
