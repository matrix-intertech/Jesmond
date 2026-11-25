import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AppointmentStatus,
  ReminderStatus,
  ReminderType,
  ReminderRecipientType,
  NotificationEventType,
  OutboxStatus,
} from '@prisma/client';

export interface ProcessedReminderSummary {
  processed: number;
  sent: number;
  missed: number;
  cancelled: number;
}

@Injectable()
export class AppointmentReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentReminderService.name);
  private checkIntervalHandle: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Poll for due appointment reminders every 30 seconds
    this.checkIntervalHandle = setInterval(() => {
      this.processDueReminders(50).catch((err) =>
        this.logger.error(`Error in appointment reminder poll tick: ${err.message}`, err.stack),
      );
    }, 30000);
  }

  onModuleDestroy() {
    if (this.checkIntervalHandle) {
      clearInterval(this.checkIntervalHandle);
    }
  }

  /**
   * Processes all currently due appointment reminders in PostgreSQL.
   * Concurrency-safe: claims rows using PostgreSQL SELECT ... FOR UPDATE SKIP LOCKED.
   */
  async processDueReminders(batchSize: number = 50): Promise<ProcessedReminderSummary> {
    if (this.isProcessing) {
      return { processed: 0, sent: 0, missed: 0, cancelled: 0 };
    }
    this.isProcessing = true;

    const summary: ProcessedReminderSummary = {
      processed: 0,
      sent: 0,
      missed: 0,
      cancelled: 0,
    };

    try {
      // 1. Claim due reminders in a short locking transaction
      const claimedReminders = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "AppointmentReminder"
          WHERE status = 'SCHEDULED'::"ReminderStatus"
            AND "scheduledFor" <= NOW()
          ORDER BY "scheduledFor" ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        `;

        if (!rows || rows.length === 0) {
          return [];
        }

        const ids = rows.map((r) => r.id);
        return tx.appointmentReminder.findMany({
          where: { id: { in: ids } },
          include: {
            appointment: {
              include: {
                customer: true,
                staff: {
                  include: {
                    user: true,
                  },
                },
                branch: true,
              },
            },
          },
        });
      });

      if (claimedReminders.length === 0) {
        return summary;
      }

      summary.processed = claimedReminders.length;

      // 2. Evaluate each claimed reminder against durable business rules
      for (const reminder of claimedReminders) {
        await this.evaluateAndDispatchReminder(reminder, summary);
      }

      return summary;
    } catch (err: any) {
      this.logger.error(`Error processing due appointment reminders: ${err.message}`, err.stack);
      return summary;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Evaluates an individual reminder against appointment confirmation status,
   * scheduleVersion matching, and the 15-minute grace window.
   */
  private async evaluateAndDispatchReminder(
    reminder: any,
    summary: ProcessedReminderSummary,
  ): Promise<void> {
    const { appointment } = reminder;

    // A. Check appointment existence
    if (!appointment) {
      await this.prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: ReminderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: 'Appointment no longer exists',
        },
      });
      summary.cancelled++;
      return;
    }

    // B. Check appointment status: must be CONFIRMED
    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      await this.prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: ReminderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: `Appointment status is ${appointment.status} (expected CONFIRMED)`,
        },
      });
      summary.cancelled++;
      return;
    }

    // C. Check scheduleVersion: must match the appointment's current scheduleVersion
    if (reminder.scheduleVersion !== appointment.scheduleVersion) {
      await this.prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: ReminderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: `Outdated schedule version (${reminder.scheduleVersion} vs current ${appointment.scheduleVersion})`,
        },
      });
      summary.cancelled++;
      return;
    }

    // D. 15-Minute Grace Window & Start Time Validation
    const nowMs = Date.now();
    const scheduledForMs = new Date(reminder.scheduledFor).getTime();
    const startTimeMs = new Date(appointment.startTime).getTime();

    // If appointment has already started, reminder is MISSED (do not alarm users)
    if (startTimeMs <= nowMs) {
      await this.prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: ReminderStatus.MISSED,
          cancellationReason: 'Appointment has already commenced',
        },
      });
      summary.missed++;
      return;
    }

    // If reminder is older than 15 minutes past scheduledFor (e.g., worker downtime), mark MISSED
    const graceWindowMs = 15 * 60 * 1000;
    if (nowMs - scheduledForMs > graceWindowMs) {
      await this.prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: ReminderStatus.MISSED,
          cancellationReason: 'Reminder delivery window expired (>15 minutes late)',
        },
      });
      summary.missed++;
      return;
    }

    // E. Valid reminder — create transactional outbox notification and mark reminder SENT
    const eventType =
      reminder.reminderType === ReminderType.BEFORE_24_HOURS
        ? NotificationEventType.APPOINTMENT_REMINDER_24H
        : NotificationEventType.APPOINTMENT_REMINDER_1H;

    await this.prisma.$transaction(async (tx) => {
      // 1. Insert into NotificationOutbox
      await tx.notificationOutbox.create({
        data: {
          eventType,
          aggregateType: 'Appointment',
          aggregateId: appointment.id,
          payload: {
            appointmentId: appointment.id,
            serviceName: appointment.serviceName,
            startTime: appointment.startTime.toISOString(),
            timezone: appointment.timezone || 'Australia/Sydney',
            customerId: appointment.customerId,
            staffUserId: appointment.staff?.userId || null,
            organizationId: appointment.branch?.organizationId || null,
            reminderId: reminder.id,
            reminderType: reminder.reminderType,
            recipientType: reminder.recipientType,
            recipientUserId: reminder.recipientUserId,
          },
          status: OutboxStatus.PENDING,
          scheduledFor: new Date(),
        },
      });

      // 2. Mark reminder as SENT
      await tx.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: ReminderStatus.SENT,
          sentAt: new Date(),
        },
      });
    });

    summary.sent++;
  }

  /**
   * Cancels all scheduled reminders for an appointment.
   */
  async cancelRemindersForAppointment(appointmentId: string, reason?: string): Promise<number> {
    const result = await this.prisma.appointmentReminder.updateMany({
      where: {
        appointmentId,
        status: ReminderStatus.SCHEDULED,
      },
      data: {
        status: ReminderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason || 'Cancelled by system/user',
      },
    });

    return result.count;
  }
}
