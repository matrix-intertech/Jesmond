import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { WhatsAppTemplateService } from '../../whatsapp/services/whatsapp-template.service';
import { Msg91Provider } from '../../whatsapp/providers/msg91.provider';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../../whatsapp/constants/whatsapp.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';

export interface AppointmentNotificationResult {
  sent: boolean;
  event: WhatsAppEvent;
  recipientCount?: number;
  reason?: string;
}

/**
 * Service orchestrating WhatsApp notifications and BullMQ reminder scheduling
 * for the Jesmond Appointments module.
 *
 * Implements:
 * Customer notifications:
 * 1. APPOINTMENT_REQUEST_RECEIVED (Booking request received, awaiting manager approval)
 * 2. APPOINTMENT_CONFIRMED (Manager approved booking request)
 * 3. APPOINTMENT_REMINDER (Scheduled before appointment)
 * 4. APPOINTMENT_CANCELLED (Appointment cancelled by customer or business)
 * 5. APPOINTMENT_RESCHEDULED (Appointment moved to new time slot)
 *
 * Service provider notifications:
 * 1. SERVICE_PROVIDER_NEW_APPOINTMENT (New appointment request received)
 * 2. SERVICE_PROVIDER_APPOINTMENT_CONFIRMED (Appointment approved by manager)
 * 3. SERVICE_PROVIDER_APPOINTMENT_REMINDER (Scheduled before appointment)
 * 4. SERVICE_PROVIDER_APPOINTMENT_CANCELLED (Appointment cancelled)
 */
@Injectable()
export class AppointmentWhatsAppService {
  private readonly logger = new Logger(AppointmentWhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
    private readonly templateService: WhatsAppTemplateService,
    private readonly msg91Provider: Msg91Provider,
  ) {}

  /**
   * Normalizes a phone number to standard international / E.164 format.
   */
  private normalizePhone(
    phone: string | null | undefined,
    countryCode?: string | null,
  ): string | null {
    if (!phone) return null;
    const combined = countryCode
      ? `${countryCode}${phone}`.replace(/\s/g, '')
      : phone.replace(/\s/g, '');

    const { normalized, isValid, reason } =
      this.msg91Provider.normalizePhoneNumber(combined);

    if (!isValid) {
      this.logger.warn(`Appointment WhatsApp: Invalid phone "${phone}": ${reason}`);
      return null;
    }

    return normalized;
  }

  /**
   * Checks whether the event template is currently approved.
   */
  private isTemplateApproved(event: WhatsAppEvent): boolean {
    try {
      const template = this.templateService.getTemplate(event);
      if (!template) return false;
      return template.status === WhatsAppTemplateStatus.APPROVED;
    } catch {
      return false;
    }
  }

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
   * Helper to retrieve full appointment context.
   */
  private async getAppointmentContext(appointmentId: string) {
    return this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            countryCode: true,
            whatsappNotifications: true,
          },
        },
        staff: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                countryCode: true,
                whatsappNotifications: true,
              },
            },
          },
        },
        branch: { select: { id: true, name: true, phone: true } },
        organization: { select: { id: true, name: true } },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Customer Notifications
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Customer: APPOINTMENT_REQUEST_RECEIVED
   * Triggered immediately after pending booking request is persisted.
   * Explicitly informs customer that the request is awaiting manager approval.
   */
  async notifyBookingRequestReceived(
    appointmentId: string,
  ): Promise<AppointmentNotificationResult> {
    const appointment = await this.getAppointmentContext(appointmentId);
    if (!appointment) {
      return {
        sent: false,
        event: WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED,
        reason: 'Appointment not found',
      };
    }

    if (!this.isTemplateApproved(WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED)) {
      this.logger.warn(
        `Template for ${WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED} is pending approval. Skipping.`,
      );
      return {
        sent: false,
        event: WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED,
        reason: 'Template pending approval',
      };
    }

    const customer = appointment.customer;
    const phone = this.normalizePhone(customer.phone, customer.countryCode);
    if (!phone) {
      return {
        sent: false,
        event: WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED,
        reason: 'Missing or invalid customer phone',
      };
    }

    const customerName =
      `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
      'Customer';
    const appointmentTime = this.formatAppointmentTime(
      appointment.startTime,
      appointment.timezone,
    );

    const idempotencyKey = `wa_appt_req_${appointmentId}`;

    try {
      await this.whatsAppService.sendNotificationAsync({
        event: WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED,
        recipient: phone,
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

      return { sent: true, event: WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED };
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch request received WA: ${err.message}`);
      return {
        sent: false,
        event: WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED,
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
  ): Promise<AppointmentNotificationResult> {
    const appointment = await this.getAppointmentContext(appointmentId);
    if (!appointment) {
      return {
        sent: false,
        event: WhatsAppEvent.APPOINTMENT_CONFIRMED,
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
    if (this.isTemplateApproved(WhatsAppEvent.APPOINTMENT_CONFIRMED)) {
      const customer = appointment.customer;
      const customerPhone = this.normalizePhone(
        customer.phone,
        customer.countryCode,
      );
      if (customerPhone) {
        const customerName =
          `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
          'Customer';
        const idempotencyKey = `wa_appt_conf_${appointmentId}`;

        try {
          await this.whatsAppService.sendNotificationAsync({
            event: WhatsAppEvent.APPOINTMENT_CONFIRMED,
            recipient: customerPhone,
            userId: customer.id,
            relatedEntityId: appointmentId,
            variables: {
              customer_name: customerName,
              service_name: appointment.serviceName,
              appointment_time: appointmentTime,
            },
            idempotencyKey,
            metadata: { appointmentId, status: appointment.status },
          });
          customerSent = true;
        } catch (err: any) {
          this.logger.warn(`Failed customer confirm WA: ${err.message}`);
        }
      }
    }

    // 2. Notify Assigned Staff / Provider
    if (
      appointment.staff?.user &&
      this.isTemplateApproved(
        WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED,
      )
    ) {
      const staffUser = appointment.staff.user;
      const staffPhone = this.normalizePhone(
        staffUser.phone,
        staffUser.countryCode,
      );
      if (staffPhone) {
        const providerName =
          `${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim() ||
          'Team Member';
        const idempotencyKey = `wa_sp_conf_${appointmentId}_${staffUser.id}`;

        try {
          await this.whatsAppService.sendNotificationAsync({
            event: WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED,
            recipient: staffPhone,
            userId: staffUser.id,
            relatedEntityId: appointmentId,
            variables: {
              provider_name: providerName,
              service_name: appointment.serviceName,
              appointment_time: appointmentTime,
            },
            idempotencyKey,
            metadata: { appointmentId, status: appointment.status },
          });
          providerSent = true;
        } catch (err: any) {
          this.logger.warn(`Failed provider confirm WA: ${err.message}`);
        }
      }
    }

    // Schedule 24h & 2h appointment reminders
    this.scheduleAppointmentReminders(appointment).catch((err) =>
      this.logger.warn(`Failed to schedule reminders: ${err.message}`),
    );

    return {
      sent: customerSent || providerSent,
      event: WhatsAppEvent.APPOINTMENT_CONFIRMED,
    };
  }

  /**
   * Customer & Provider: APPOINTMENT_CANCELLED & SERVICE_PROVIDER_APPOINTMENT_CANCELLED
   * Triggered upon cancellation by customer or business.
   */
  async notifyAppointmentCancelled(
    appointmentId: string,
    reason?: string,
  ): Promise<AppointmentNotificationResult> {
    const appointment = await this.getAppointmentContext(appointmentId);
    if (!appointment) {
      return {
        sent: false,
        event: WhatsAppEvent.APPOINTMENT_CANCELLED,
        reason: 'Appointment not found',
      };
    }

    // Invalidate any pending reminders in BullMQ queue
    await this.cancelScheduledReminders(appointmentId);

    const appointmentTime = this.formatAppointmentTime(
      appointment.startTime,
      appointment.timezone,
    );
    const cancelReason = reason || 'Cancelled by request';

    // 1. Customer cancellation notice
    if (this.isTemplateApproved(WhatsAppEvent.APPOINTMENT_CANCELLED)) {
      const customer = appointment.customer;
      const customerPhone = this.normalizePhone(
        customer.phone,
        customer.countryCode,
      );
      if (customerPhone) {
        const customerName =
          `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
          'Customer';
        const idempotencyKey = `wa_appt_cancel_${appointmentId}`;

        this.whatsAppService
          .sendNotificationAsync({
            event: WhatsAppEvent.APPOINTMENT_CANCELLED,
            recipient: customerPhone,
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
            this.logger.warn(`Failed customer cancel WA: ${err.message}`),
          );
      }
    }

    // 2. Service provider cancellation notice
    if (
      appointment.staff?.user &&
      this.isTemplateApproved(
        WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_CANCELLED,
      )
    ) {
      const staffUser = appointment.staff.user;
      const staffPhone = this.normalizePhone(
        staffUser.phone,
        staffUser.countryCode,
      );
      if (staffPhone) {
        const providerName =
          `${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim() ||
          'Team Member';
        const idempotencyKey = `wa_sp_cancel_${appointmentId}_${staffUser.id}`;

        this.whatsAppService
          .sendNotificationAsync({
            event: WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_CANCELLED,
            recipient: staffPhone,
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
            this.logger.warn(`Failed provider cancel WA: ${err.message}`),
          );
      }
    }

    return { sent: true, event: WhatsAppEvent.APPOINTMENT_CANCELLED };
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
  }): Promise<AppointmentNotificationResult> {
    const { appointmentId, oldStartTime, newStartTime, timezone } = params;

    // Invalidate existing scheduled reminders
    await this.cancelScheduledReminders(appointmentId);

    const appointment = await this.getAppointmentContext(appointmentId);
    if (!appointment) {
      return {
        sent: false,
        event: WhatsAppEvent.APPOINTMENT_RESCHEDULED,
        reason: 'Appointment not found',
      };
    }

    // Schedule new reminders for the new start time if confirmed
    if (appointment.status === AppointmentStatus.CONFIRMED) {
      await this.scheduleAppointmentReminders(appointment);
    }

    if (!this.isTemplateApproved(WhatsAppEvent.APPOINTMENT_RESCHEDULED)) {
      return {
        sent: false,
        event: WhatsAppEvent.APPOINTMENT_RESCHEDULED,
        reason: 'Template pending approval',
      };
    }

    const customer = appointment.customer;
    const customerPhone = this.normalizePhone(
      customer.phone,
      customer.countryCode,
    );
    if (!customerPhone) {
      return {
        sent: false,
        event: WhatsAppEvent.APPOINTMENT_RESCHEDULED,
        reason: 'Missing customer phone',
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

    const idempotencyKey = `wa_appt_resched_${appointmentId}_${newStartTime.getTime()}`;

    try {
      await this.whatsAppService.sendNotificationAsync({
        event: WhatsAppEvent.APPOINTMENT_RESCHEDULED,
        recipient: customerPhone,
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

      return { sent: true, event: WhatsAppEvent.APPOINTMENT_RESCHEDULED };
    } catch (err: any) {
      return {
        sent: false,
        event: WhatsAppEvent.APPOINTMENT_RESCHEDULED,
        reason: err.message,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Service Provider Notifications
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Service Provider: SERVICE_PROVIDER_NEW_APPOINTMENT
   * Triggered when new request is booked. Notifies assigned staff or business managers.
   */
  async notifyProviderNewAppointment(
    appointmentId: string,
  ): Promise<AppointmentNotificationResult> {
    const appointment = await this.getAppointmentContext(appointmentId);
    if (!appointment) {
      return {
        sent: false,
        event: WhatsAppEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
        reason: 'Appointment not found',
      };
    }

    if (
      !this.isTemplateApproved(
        WhatsAppEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
      )
    ) {
      return {
        sent: false,
        event: WhatsAppEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
        reason: 'Template pending approval',
      };
    }

    const appointmentTime = this.formatAppointmentTime(
      appointment.startTime,
      appointment.timezone,
    );

    // Identify recipient staff member(s)
    const staffRecipients: Array<{
      userId: string;
      name: string;
      phone: string;
      countryCode?: string | null;
    }> = [];

    if (appointment.staff?.user?.phone) {
      staffRecipients.push({
        userId: appointment.staff.user.id,
        name:
          `${appointment.staff.user.firstName || ''} ${appointment.staff.user.lastName || ''}`.trim() ||
          'Team Member',
        phone: appointment.staff.user.phone,
        countryCode: appointment.staff.user.countryCode,
      });
    } else {
      // Fallback: Notify branch staff / org admins
      const orgAdmins = await this.prisma.orgStaff.findMany({
        where: {
          organizationId: appointment.organizationId,
          role: 'ADMIN',
          deletedAt: null,
        },
        include: { user: true },
      });
      for (const admin of orgAdmins) {
        if (admin.user?.phone) {
          staffRecipients.push({
            userId: admin.user.id,
            name:
              `${admin.user.firstName || ''} ${admin.user.lastName || ''}`.trim() ||
              'Admin',
            phone: admin.user.phone,
            countryCode: admin.user.countryCode,
          });
        }
      }
    }

    let dispatched = 0;
    for (const recipient of staffRecipients) {
      const staffPhone = this.normalizePhone(
        recipient.phone,
        recipient.countryCode,
      );
      if (!staffPhone) continue;

      const idempotencyKey = `wa_sp_new_${appointmentId}_${recipient.userId}`;
      this.whatsAppService
        .sendNotificationAsync({
          event: WhatsAppEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
          recipient: staffPhone,
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
          this.logger.warn(`Failed SP new appointment WA: ${err.message}`),
        );

      dispatched++;
    }

    return {
      sent: dispatched > 0,
      event: WhatsAppEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
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
        `Appointment ${appointment.id} is within 24 hours; skipping delayed reminder schedule.`,
      );
      return;
    }

    const appointmentTime = this.formatAppointmentTime(
      appointment.startTime,
      appointment.timezone,
    );

    // 1. Schedule Customer Reminder
    if (this.isTemplateApproved(WhatsAppEvent.APPOINTMENT_REMINDER)) {
      const customer = appointment.customer;
      const phone = this.normalizePhone(customer.phone, customer.countryCode);
      if (phone) {
        const customerName =
          `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
          'Customer';
        const jobId = `reminder_cust_${appointment.id}`;

        await this.whatsAppService.sendNotificationAsync({
          event: WhatsAppEvent.APPOINTMENT_REMINDER,
          recipient: phone,
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
    }

    // 2. Schedule Service Provider Reminder
    if (
      appointment.staff?.user &&
      this.isTemplateApproved(
        WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER,
      )
    ) {
      const staffUser = appointment.staff.user;
      const staffPhone = this.normalizePhone(
        staffUser.phone,
        staffUser.countryCode,
      );
      if (staffPhone) {
        const providerName =
          `${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim() ||
          'Team Member';
        const jobId = `reminder_sp_${appointment.id}_${staffUser.id}`;

        await this.whatsAppService.sendNotificationAsync({
          event: WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER,
          recipient: staffPhone,
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
  }

  /**
   * Cancels previously scheduled reminders from BullMQ queue.
   */
  async cancelScheduledReminders(appointmentId: string): Promise<void> {
    const customerReminderJobId = `reminder_cust_${appointmentId}`;
    await this.whatsAppService.cancelScheduledJob(customerReminderJobId);

    // Cancel provider reminder (check if staffId assigned)
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { staff: { select: { userId: true } } },
    });
    if (appointment?.staff?.userId) {
      const providerReminderJobId = `reminder_sp_${appointmentId}_${appointment.staff.userId}`;
      await this.whatsAppService.cancelScheduledJob(providerReminderJobId);
    }
  }

  /**
   * Final safeguard: Rechecks whether appointment is still CONFIRMED before firing reminder.
   */
  async shouldDeliverReminder(appointmentId: string): Promise<boolean> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { status: true },
    });
    return appt?.status === AppointmentStatus.CONFIRMED;
  }
}
