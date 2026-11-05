import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { EmailEvent } from '../../email/constants/email.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentStatus, UserRole } from '@prisma/client';

export interface AppointmentEmailNotificationResult {
  sent: boolean;
  event: EmailEvent;
  recipientCount?: number;
  reason?: string;
}

@Injectable()
export class AppointmentEmailService {
  private readonly logger = new Logger(AppointmentEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Formats a Date into a human-readable local appointment time string.
   */
  private formatAppointmentTime(date: Date, timezone?: string): string {
    try {
      return date.toLocaleString('en-AU', {
        timeZone: timezone || 'Australia/Sydney',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return date.toUTCString();
    }
  }

  /**
   * Loads full appointment context including customer, service, branch, and staff relations.
   */
  private async getAppointmentContext(appointmentId: string) {
    return this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            emailNotifications: true,
          },
        },
        staff: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                emailNotifications: true,
              },
            },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Customer & Provider Notifications
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Customer: APPOINTMENT_REQUEST_RECEIVED
   * Triggered when customer creates a booking request that is awaiting business approval.
   */
  async notifyAppointmentRequestReceived(
    appointmentId: string,
  ): Promise<AppointmentEmailNotificationResult> {
    const appointment = await this.getAppointmentContext(appointmentId);
    if (!appointment) {
      return {
        sent: false,
        event: EmailEvent.APPOINTMENT_REQUEST_RECEIVED,
        reason: 'Appointment not found',
      };
    }

    const customer = appointment.customer;
    if (!customer?.email) {
      return {
        sent: false,
        event: EmailEvent.APPOINTMENT_REQUEST_RECEIVED,
        reason: 'Missing customer email',
      };
    }

    const customerName =
      `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
      'Customer';
    const appointmentTime = this.formatAppointmentTime(
      appointment.startTime,
      appointment.timezone,
    );

    const idempotencyKey = `email_appt_req_${appointmentId}`;

    try {
      await this.emailService.sendEmailAsync({
        event: EmailEvent.APPOINTMENT_REQUEST_RECEIVED,
        recipient: customer.email,
        userId: customer.id,
        relatedEntityId: appointmentId,
        variables: {
          customer_name: customerName,
          service_name: appointment.serviceName,
          appointment_time: appointmentTime,
        },
        idempotencyKey,
        metadata: {
          appointmentId,
          status: appointment.status,
          branchName: appointment.branch?.name,
        },
      });

      return { sent: true, event: EmailEvent.APPOINTMENT_REQUEST_RECEIVED };
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch request received email: ${err.message}`);
      return {
        sent: false,
        event: EmailEvent.APPOINTMENT_REQUEST_RECEIVED,
        reason: err.message,
      };
    }
  }

  /**
   * Customer & Provider: APPOINTMENT_CONFIRMED & SERVICE_PROVIDER_APPOINTMENT_CONFIRMED
   * Triggered only when manager approves the appointment.
   */
  async notifyAppointmentConfirmed(
    appointmentId: string,
  ): Promise<AppointmentEmailNotificationResult> {
    const appointment = await this.getAppointmentContext(appointmentId);
    if (!appointment) {
      return {
        sent: false,
        event: EmailEvent.APPOINTMENT_CONFIRMED,
        reason: 'Appointment not found',
      };
    }

    const appointmentTime = this.formatAppointmentTime(
      appointment.startTime,
      appointment.timezone,
    );

    let customerSent = false;
    let providerSent = false;

    // 1. Notify Customer
    const customer = appointment.customer;
    if (customer?.email) {
      const customerName =
        `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
        'Customer';
      const idempotencyKey = `email_appt_conf_${appointmentId}`;

      try {
        await this.emailService.sendEmailAsync({
          event: EmailEvent.APPOINTMENT_CONFIRMED,
          recipient: customer.email,
          userId: customer.id,
          relatedEntityId: appointmentId,
          variables: {
            customer_name: customerName,
            service_name: appointment.serviceName,
            appointment_time: appointmentTime,
          },
          idempotencyKey,
          metadata: { appointmentId, branchName: appointment.branch?.name },
        });
        customerSent = true;
      } catch (err: any) {
        this.logger.warn(`Failed customer confirmation email: ${err.message}`);
      }
    }

    // 2. Notify Assigned Staff Professional
    if (appointment.staff?.user?.email) {
      const staffUser = appointment.staff.user;
      const providerName =
        `${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim() ||
        'Team Member';
      const idempotencyKey = `email_sp_conf_${appointmentId}_${staffUser.id}`;

      try {
        await this.emailService.sendEmailAsync({
          event: EmailEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED,
          recipient: staffUser.email,
          userId: staffUser.id,
          relatedEntityId: appointmentId,
          variables: {
            provider_name: providerName,
            service_name: appointment.serviceName,
            appointment_time: appointmentTime,
          },
          idempotencyKey,
          metadata: { appointmentId, branchName: appointment.branch?.name },
        });
        providerSent = true;
      } catch (err: any) {
        this.logger.warn(`Failed provider confirmation email: ${err.message}`);
      }
    }

    // 3. Schedule 24h reminder
    await this.scheduleAppointmentReminders(appointment);

    return {
      sent: customerSent || providerSent,
      event: EmailEvent.APPOINTMENT_CONFIRMED,
      recipientCount: (customerSent ? 1 : 0) + (providerSent ? 1 : 0),
    };
  }

  /**
   * Customer & Provider: APPOINTMENT_CANCELLED & SERVICE_PROVIDER_APPOINTMENT_CANCELLED
   * Triggered when an appointment is cancelled by customer or business.
   */
  async notifyAppointmentCancelled(
    appointmentId: string,
    reason?: string,
  ): Promise<AppointmentEmailNotificationResult> {
    // Invalidate any future reminders
    await this.cancelScheduledReminders(appointmentId);

    const appointment = await this.getAppointmentContext(appointmentId);
    if (!appointment) {
      return {
        sent: false,
        event: EmailEvent.APPOINTMENT_CANCELLED,
        reason: 'Appointment not found',
      };
    }

    const appointmentTime = this.formatAppointmentTime(
      appointment.startTime,
      appointment.timezone,
    );
    const cancelReason = reason || 'Cancelled by request';

    // 1. Customer cancellation notice
    const customer = appointment.customer;
    if (customer?.email) {
      const customerName =
        `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
        'Customer';
      const idempotencyKey = `email_appt_cancel_${appointmentId}`;

      this.emailService
        .sendEmailAsync({
          event: EmailEvent.APPOINTMENT_CANCELLED,
          recipient: customer.email,
          userId: customer.id,
          relatedEntityId: appointmentId,
          variables: {
            customer_name: customerName,
            service_name: appointment.serviceName,
            reason: cancelReason,
          },
          idempotencyKey,
          metadata: { appointmentId, reason: cancelReason },
        })
        .catch((err) =>
          this.logger.warn(`Failed customer cancel email: ${err.message}`),
        );
    }

    // 2. Service provider cancellation notice
    if (appointment.staff?.user?.email) {
      const staffUser = appointment.staff.user;
      const providerName =
        `${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim() ||
        'Team Member';
      const idempotencyKey = `email_sp_cancel_${appointmentId}_${staffUser.id}`;

      this.emailService
        .sendEmailAsync({
          event: EmailEvent.SERVICE_PROVIDER_APPOINTMENT_CANCELLED,
          recipient: staffUser.email,
          userId: staffUser.id,
          relatedEntityId: appointmentId,
          variables: {
            provider_name: providerName,
            service_name: appointment.serviceName,
            appointment_time: appointmentTime,
          },
          idempotencyKey,
          metadata: { appointmentId, reason: cancelReason },
        })
        .catch((err) =>
          this.logger.warn(`Failed provider cancel email: ${err.message}`),
        );
    }

    return { sent: true, event: EmailEvent.APPOINTMENT_CANCELLED };
  }

  /**
   * Customer: APPOINTMENT_RESCHEDULED
   * Invalidate old reminders, schedule new reminders, and notify customer.
   */
  async notifyAppointmentRescheduled(params: {
    appointmentId: string;
    oldStartTime: Date;
    newStartTime: Date;
    timezone?: string;
  }): Promise<AppointmentEmailNotificationResult> {
    const { appointmentId, oldStartTime, newStartTime, timezone } = params;

    // Invalidate existing scheduled reminders
    await this.cancelScheduledReminders(appointmentId);

    const appointment = await this.getAppointmentContext(appointmentId);
    if (!appointment) {
      return {
        sent: false,
        event: EmailEvent.APPOINTMENT_RESCHEDULED,
        reason: 'Appointment not found',
      };
    }

    const customer = appointment.customer;
    if (!customer?.email) {
      return {
        sent: false,
        event: EmailEvent.APPOINTMENT_RESCHEDULED,
        reason: 'Missing customer email',
      };
    }

    const customerName =
      `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
      'Customer';
    const oldTimeStr = this.formatAppointmentTime(
      oldStartTime,
      timezone || appointment.timezone,
    );
    const newTimeStr = this.formatAppointmentTime(
      newStartTime,
      timezone || appointment.timezone,
    );

    const idempotencyKey = `email_appt_resched_${appointmentId}_${newStartTime.getTime()}`;

    try {
      await this.emailService.sendEmailAsync({
        event: EmailEvent.APPOINTMENT_RESCHEDULED,
        recipient: customer.email,
        userId: customer.id,
        relatedEntityId: appointmentId,
        variables: {
          customer_name: customerName,
          service_name: appointment.serviceName,
          old_time: oldTimeStr,
          new_time: newTimeStr,
        },
        idempotencyKey,
        metadata: {
          appointmentId,
          oldStartTime: oldStartTime.toISOString(),
          newStartTime: newStartTime.toISOString(),
        },
      });

      // Schedule reminders for new time
      await this.scheduleAppointmentReminders({
        ...appointment,
        startTime: newStartTime,
      });

      return { sent: true, event: EmailEvent.APPOINTMENT_RESCHEDULED };
    } catch (err: any) {
      return {
        sent: false,
        event: EmailEvent.APPOINTMENT_RESCHEDULED,
        reason: err.message,
      };
    }
  }

  /**
   * Service Provider: SERVICE_PROVIDER_NEW_APPOINTMENT
   * Triggered when new request is booked. Notifies assigned staff or business managers.
   */
  async notifyProviderNewAppointment(
    appointmentId: string,
  ): Promise<AppointmentEmailNotificationResult> {
    const appointment = await this.getAppointmentContext(appointmentId);
    if (!appointment) {
      return {
        sent: false,
        event: EmailEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
        reason: 'Appointment not found',
      };
    }

    const appointmentTime = this.formatAppointmentTime(
      appointment.startTime,
      appointment.timezone,
    );

    const staffRecipients: Array<{ userId: string; email: string; name: string }> = [];

    // If staff is pre-assigned
    if (appointment.staff?.user?.email) {
      const u = appointment.staff.user;
      staffRecipients.push({
        userId: u.id,
        email: u.email,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Team Member',
      });
    } else {
      // Find branch / organization admins
      const orgStaff: any[] = await (this.prisma.orgStaff as any).findMany({
        where: {
          organizationId: appointment.branch.organizationId,
          role: { in: [UserRole.ADMIN, UserRole.ORG_STAFF] },
          deletedAt: null,
        },
        include: { user: true },
      });

      for (const s of orgStaff) {
        if (s.user?.email) {
          staffRecipients.push({
            userId: s.user.id,
            email: s.user.email,
            name:
              `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() ||
              'Manager',
          });
        }
      }
    }

    if (staffRecipients.length === 0) {
      return {
        sent: false,
        event: EmailEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
        reason: 'No staff or manager email recipients found',
      };
    }

    let dispatched = 0;
    for (const recipient of staffRecipients) {
      const idempotencyKey = `email_sp_new_${appointmentId}_${recipient.userId}`;
      this.emailService
        .sendEmailAsync({
          event: EmailEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
          recipient: recipient.email,
          userId: recipient.userId,
          relatedEntityId: appointmentId,
          variables: {
            provider_name: recipient.name,
            service_name: appointment.serviceName,
            appointment_time: appointmentTime,
          },
          idempotencyKey,
          metadata: { appointmentId },
        })
        .catch((err) =>
          this.logger.warn(`Failed SP new appointment email: ${err.message}`),
        );

      dispatched++;
    }

    return {
      sent: dispatched > 0,
      event: EmailEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
      recipientCount: dispatched,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Reminder Scheduling (BullMQ delayed jobs)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Schedules customer and provider reminders 24 hours prior to appointment start.
   */
  async scheduleAppointmentReminders(appointment: any): Promise<void> {
    const now = Date.now();
    const startTimeMs = new Date(appointment.startTime).getTime();

    // 24 hours reminder offset
    const reminderOffsetMs = 24 * 60 * 60 * 1000;
    const reminderTimeMs = startTimeMs - reminderOffsetMs;
    const delayMs = reminderTimeMs - now;

    // Only schedule if reminder time is in the future
    if (delayMs <= 0) {
      this.logger.log(
        `Appointment ${appointment.id} is within 24 hours; skipping delayed email reminder schedule.`,
      );
      return;
    }

    const appointmentTime = this.formatAppointmentTime(
      appointment.startTime,
      appointment.timezone,
    );

    // 1. Schedule Customer Reminder
    const customer = appointment.customer;
    if (customer?.email) {
      const customerName =
        `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
        'Customer';
      const jobId = `email_reminder_cust_${appointment.id}`;

      await this.emailService.sendEmailAsync({
        event: EmailEvent.APPOINTMENT_REMINDER,
        recipient: customer.email,
        userId: customer.id,
        relatedEntityId: appointment.id,
        variables: {
          customer_name: customerName,
          service_name: appointment.serviceName,
          appointment_time: appointmentTime,
        },
        delayMs,
        idempotencyKey: jobId,
        metadata: {
          appointmentId: appointment.id,
          type: 'CUSTOMER_REMINDER',
          scheduledFor: new Date(reminderTimeMs).toISOString(),
        },
      });
    }

    // 2. Schedule Service Provider Reminder
    if (appointment.staff?.user?.email) {
      const staffUser = appointment.staff.user;
      const providerName =
        `${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim() ||
        'Team Member';
      const jobId = `email_reminder_sp_${appointment.id}_${staffUser.id}`;

      await this.emailService.sendEmailAsync({
        event: EmailEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER,
        recipient: staffUser.email,
        userId: staffUser.id,
        relatedEntityId: appointment.id,
        variables: {
          provider_name: providerName,
          service_name: appointment.serviceName,
          appointment_time: appointmentTime,
        },
        delayMs,
        idempotencyKey: jobId,
        metadata: {
          appointmentId: appointment.id,
          type: 'PROVIDER_REMINDER',
          scheduledFor: new Date(reminderTimeMs).toISOString(),
        },
      });
    }
  }

  /**
   * Cancels previously scheduled reminders from BullMQ queue.
   */
  async cancelScheduledReminders(appointmentId: string): Promise<void> {
    const customerReminderJobId = `email_reminder_cust_${appointmentId}`;
    await this.emailService.cancelScheduledJob(customerReminderJobId);

    // Cancel provider reminder
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { staff: { select: { userId: true } } },
    });
    if (appointment?.staff?.userId) {
      const providerReminderJobId = `email_reminder_sp_${appointmentId}_${appointment.staff.userId}`;
      await this.emailService.cancelScheduledJob(providerReminderJobId);
    }
  }
}
