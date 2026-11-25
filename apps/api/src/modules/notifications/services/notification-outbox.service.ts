import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { EmailEvent } from '../../email/constants/email.constants';
import {
  NotificationEventType,
  OutboxStatus,
  NotificationChannel,
  NotificationCategory,
  DeliveryStatus,
  UserRole,
} from '@prisma/client';
import * as os from 'os';

export interface OutboxClaimedItem {
  id: string;
  eventType: NotificationEventType;
  aggregateType: string;
  aggregateId: string;
  payload: any;
  retryCount: number;
}

@Injectable()
export class NotificationOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxService.name);
  private readonly workerId = `${os.hostname()}-${process.pid}-${Math.random().toString(36).substring(2, 7)}`;
  private pollIntervalHandle: NodeJS.Timeout | null = null;
  private staleRecoveryIntervalHandle: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    // Start automated background polling (every 10 seconds in development / production)
    this.pollIntervalHandle = setInterval(() => {
      this.processPendingOutbox(50).catch((err) =>
        this.logger.error(`Error in outbox poll tick: ${err.message}`, err.stack),
      );
    }, 10000);

    // Watchdog: recover stale PROCESSING rows every 60 seconds
    this.staleRecoveryIntervalHandle = setInterval(() => {
      this.recoverStaleProcessing().catch((err) =>
        this.logger.error(`Error in stale outbox recovery: ${err.message}`, err.stack),
      );
    }, 60000);
  }

  onModuleDestroy() {
    if (this.pollIntervalHandle) clearInterval(this.pollIntervalHandle);
    if (this.staleRecoveryIntervalHandle) clearInterval(this.staleRecoveryIntervalHandle);
  }

  /**
   * PostgreSQL SELECT ... FOR UPDATE SKIP LOCKED batch claiming.
   * Claims up to `batchSize` PENDING records with an ultra-short transaction.
   */
  async claimBatch(batchSize: number = 50): Promise<OutboxClaimedItem[]> {
    return this.prisma.$transaction(async (tx) => {
      const claimable = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "NotificationOutbox"
        WHERE status = 'PENDING'::"OutboxStatus"
          AND "scheduledFor" <= NOW()
        ORDER BY "scheduledFor" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (!claimable || claimable.length === 0) {
        return [];
      }

      const ids = claimable.map((c) => c.id);

      await tx.$executeRaw`
        UPDATE "NotificationOutbox"
        SET status = 'PROCESSING'::"OutboxStatus",
            "lockedBy" = ${this.workerId},
            "lockedAt" = NOW()
        WHERE id = ANY(${ids}::text[])
      `;

      const rows = await tx.notificationOutbox.findMany({
        where: { id: { in: ids } },
      });

      return rows.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        aggregateType: r.aggregateType,
        aggregateId: r.aggregateId,
        payload: r.payload,
        retryCount: r.retryCount,
      }));
    });
  }

  /**
   * Processes all currently claimable outbox records.
   */
  async processPendingOutbox(batchSize: number = 50): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const batch = await this.claimBatch(batchSize);
      if (batch.length === 0) return 0;

      for (const item of batch) {
        await this.processSingleOutboxItem(item);
      }

      return batch.length;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processes a single claimed outbox item.
   */
  private async processSingleOutboxItem(item: OutboxClaimedItem): Promise<void> {
    try {
      const payload = item.payload || {};
      const appointmentId = payload.appointmentId || item.aggregateId;

      // 1. Resolve recipients for event
      const recipients = await this.resolveRecipients(item.eventType, payload, appointmentId);

      // 2. Dispatch to each recipient across channels (In-App + Email)
      for (const recipient of recipients) {
        await this.dispatchToRecipient(item, recipient, payload);
      }

      // 3. Mark outbox row as PROCESSED
      await this.prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: OutboxStatus.PROCESSED,
          processedAt: new Date(),
          lockedBy: null,
          lockedAt: null,
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed processing outbox record ${item.id} (${item.eventType}): ${err.message}`,
        err.stack,
      );

      const nextRetry = item.retryCount + 1;
      const willFail = nextRetry >= 3;

      await this.prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: willFail ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          retryCount: nextRetry,
          errorMessage: err.message,
          lockedBy: null,
          lockedAt: null,
          // Exponential backoff if retrying (5s, 10s, etc.)
          scheduledFor: willFail ? undefined : new Date(Date.now() + nextRetry * 5000),
        },
      });
    }
  }

  /**
   * Resolves recipient user records and applies strict deduplication by userId.
   */
  private async resolveRecipients(
    eventType: NotificationEventType,
    payload: any,
    appointmentId: string,
  ): Promise<Array<{ userId: string; email?: string; name: string; isBusiness: boolean }>> {
    const recipientMap = new Map<string, { userId: string; email?: string; name: string; isBusiness: boolean }>();

    // 0. Targeted recipient resolution (e.g. individual AppointmentReminder rows)
    if (
      (eventType === NotificationEventType.APPOINTMENT_REMINDER_24H ||
        eventType === NotificationEventType.APPOINTMENT_REMINDER_1H) &&
      payload.recipientUserId
    ) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      if (targetUser) {
        const isBusiness = payload.recipientType && payload.recipientType !== 'CUSTOMER';
        recipientMap.set(targetUser.id, {
          userId: targetUser.id,
          email: targetUser.email,
          name: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || (isBusiness ? 'Team Member' : 'Customer'),
          isBusiness: Boolean(isBusiness),
        });
      }
      return Array.from(recipientMap.values());
    }

    // 1. Customer resolution
    if (payload.customerId) {
      const customer = await this.prisma.user.findUnique({
        where: { id: payload.customerId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      if (customer) {
        recipientMap.set(customer.id, {
          userId: customer.id,
          email: customer.email,
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer',
          isBusiness: false,
        });
      }
    }

    // 2. Assigned Staff resolution
    if (payload.staffUserId) {
      const staffUser = await this.prisma.user.findUnique({
        where: { id: payload.staffUserId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      if (staffUser && !recipientMap.has(staffUser.id)) {
        recipientMap.set(staffUser.id, {
          userId: staffUser.id,
          email: staffUser.email,
          name: `${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim() || 'Team Member',
          isBusiness: true,
        });
      }
    }

    // 3. Organization Managers/Staff (for appointment booking requests or updates)
    if (
      (eventType === NotificationEventType.APPOINTMENT_REQUESTED ||
        eventType === NotificationEventType.APPOINTMENT_CANCELLED) &&
      payload.organizationId
    ) {
      const orgStaff = await this.prisma.orgStaff.findMany({
        where: {
          organizationId: payload.organizationId,
          role: { in: [UserRole.ADMIN, UserRole.ORG_STAFF] },
          deletedAt: null,
        },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      for (const s of orgStaff) {
        if (s.user && !recipientMap.has(s.user.id)) {
          recipientMap.set(s.user.id, {
            userId: s.user.id,
            email: s.user.email,
            name: `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() || 'Manager',
            isBusiness: true,
          });
        }
      }
    }

    return Array.from(recipientMap.values());
  }

  /**
   * Dispatches notifications to a recipient across In-App and Email channels.
   */
  private async dispatchToRecipient(
    outboxItem: OutboxClaimedItem,
    recipient: { userId: string; email?: string; name: string; isBusiness: boolean },
    payload: any,
  ): Promise<void> {
    const { title, body, actionUrl, emailEvent } = this.formatEventContent(
      outboxItem.eventType,
      payload,
      recipient,
    );

    const idempotencyKey = `notif_${outboxItem.id}_${recipient.userId}`;

    // 1. In-App Notification Creation
    let notification = await this.prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    if (!notification) {
      notification = await this.prisma.notification.create({
        data: {
          recipientId: recipient.userId,
          organizationId: recipient.isBusiness ? payload.organizationId : null,
          type: outboxItem.eventType,
          title,
          body,
          actionUrl,
          idempotencyKey,
          metadata: payload,
          deliveries: {
            create: {
              channel: NotificationChannel.IN_APP,
              status: DeliveryStatus.DELIVERED,
              recipientAddress: recipient.userId,
              sentAt: new Date(),
              deliveredAt: new Date(),
            },
          },
        },
      });
    }

    // 2. Email Delivery Evaluation
    if (recipient.email) {
      const canSendEmail = await this.canSendEmailToUser(
        recipient.userId,
        outboxItem.eventType,
      );

      const existingDelivery = await this.prisma.notificationDelivery.findUnique({
        where: {
          notificationId_channel: {
            notificationId: notification.id,
            channel: NotificationChannel.EMAIL,
          },
        },
      });

      if (!canSendEmail) {
        if (!existingDelivery) {
          await this.prisma.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              channel: NotificationChannel.EMAIL,
              status: DeliveryStatus.SKIPPED,
              recipientAddress: recipient.email,
              failureReason: 'USER_OPTED_OUT',
            },
          });
        }
        return;
      }

      if (!existingDelivery || existingDelivery.status === DeliveryStatus.PENDING) {
        let sesMessageId: string | undefined = undefined;
        let isSuccess = false;
        let failureReason: string | undefined = undefined;

        try {
          const tz = payload.timezone || 'Australia/Sydney';
          const formatTime = (iso?: string) =>
            iso
              ? `${new Date(iso).toLocaleString('en-AU', {
                  timeZone: tz,
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })} (${tz})`
              : '';

          const formattedAppointmentTime = formatTime(payload.startTime || payload.newStartTime);

          const emailResult = await this.emailService.sendEmail({
            event: emailEvent,
            recipient: recipient.email,
            userId: recipient.userId,
            relatedEntityId: payload.appointmentId,
            variables: {
              customer_name: recipient.name,
              provider_name: recipient.name,
              service_name: payload.serviceName || 'Appointment',
              appointment_time: formattedAppointmentTime,
              old_time: formatTime(payload.oldStartTime),
              new_time: formatTime(payload.newStartTime || payload.startTime),
              reason: payload.cancellationReason || payload.rejectionReason || '',
            },
            idempotencyKey: `email_${notification.id}`,
            metadata: payload,
          });

          isSuccess = emailResult.success;
          sesMessageId = emailResult.messageId;
          if (!isSuccess) failureReason = emailResult.error || emailResult.skippedReason;
        } catch (err: any) {
          isSuccess = false;
          failureReason = err.message;
        }

        if (existingDelivery) {
          await this.prisma.notificationDelivery.update({
            where: { id: existingDelivery.id },
            data: {
              status: isSuccess ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
              providerMessageId: sesMessageId,
              failureReason,
              sentAt: isSuccess ? new Date() : undefined,
              attemptCount: { increment: 1 },
            },
          });
        } else {
          await this.prisma.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              channel: NotificationChannel.EMAIL,
              status: isSuccess ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
              recipientAddress: recipient.email,
              providerMessageId: sesMessageId,
              failureReason,
              sentAt: isSuccess ? new Date() : undefined,
              attemptCount: 1,
            },
          });
        }
      }
    }
  }

  /**
   * Formats in-app title, body, actionUrl, and corresponding EmailEvent based on event type.
   */
  private formatEventContent(
    eventType: NotificationEventType,
    payload: any,
    recipient: { isBusiness: boolean },
  ): { title: string; body: string; actionUrl: string; emailEvent: EmailEvent } {
    const service = payload.serviceName || 'Appointment';
    const apptId = payload.appointmentId;
    const baseActionUrl = recipient.isBusiness
      ? `/portal/business/appointments/${apptId}`
      : `/my-appointments/${apptId}`;

    switch (eventType) {
      case NotificationEventType.APPOINTMENT_REQUESTED:
        return {
          title: recipient.isBusiness ? 'New Appointment Request' : 'Appointment Request Submitted',
          body: recipient.isBusiness
            ? `New request for ${service} awaiting review.`
            : `Your request for ${service} has been submitted and is awaiting approval.`,
          actionUrl: baseActionUrl,
          emailEvent: recipient.isBusiness
            ? EmailEvent.SERVICE_PROVIDER_NEW_APPOINTMENT
            : EmailEvent.APPOINTMENT_REQUEST_RECEIVED,
        };
      case NotificationEventType.APPOINTMENT_CONFIRMED:
        return {
          title: 'Appointment Confirmed',
          body: `Your appointment for ${service} is confirmed.`,
          actionUrl: baseActionUrl,
          emailEvent: recipient.isBusiness
            ? EmailEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED
            : EmailEvent.APPOINTMENT_CONFIRMED,
        };
      case NotificationEventType.APPOINTMENT_REJECTED:
        return {
          title: 'Appointment Request Declined',
          body: `Your appointment request for ${service} could not be approved.`,
          actionUrl: baseActionUrl,
          emailEvent: EmailEvent.APPOINTMENT_REJECTED,
        };
      case NotificationEventType.APPOINTMENT_CANCELLED:
        return {
          title: 'Appointment Cancelled',
          body: `The appointment for ${service} has been cancelled.`,
          actionUrl: baseActionUrl,
          emailEvent: recipient.isBusiness
            ? EmailEvent.SERVICE_PROVIDER_APPOINTMENT_CANCELLED
            : EmailEvent.APPOINTMENT_CANCELLED,
        };
      case NotificationEventType.APPOINTMENT_RESCHEDULED:
        return {
          title: 'Appointment Rescheduled',
          body: `The appointment for ${service} has been rescheduled to a new time.`,
          actionUrl: baseActionUrl,
          emailEvent: EmailEvent.APPOINTMENT_RESCHEDULED,
        };
      case NotificationEventType.APPOINTMENT_REMINDER_24H:
        return {
          title: 'Upcoming Appointment Reminder (24 Hours)',
          body: `Reminder: You have an appointment for ${service} tomorrow.`,
          actionUrl: baseActionUrl,
          emailEvent: recipient.isBusiness
            ? EmailEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER
            : EmailEvent.APPOINTMENT_REMINDER_24H,
        };
      case NotificationEventType.APPOINTMENT_REMINDER_1H:
        return {
          title: 'Upcoming Appointment Reminder (1 Hour)',
          body: `Reminder: Your appointment for ${service} begins in 1 hour.`,
          actionUrl: baseActionUrl,
          emailEvent: recipient.isBusiness
            ? EmailEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER
            : EmailEvent.APPOINTMENT_REMINDER_1H,
        };
      default:
        return {
          title: 'Appointment Update',
          body: `Update regarding your appointment for ${service}.`,
          actionUrl: baseActionUrl,
          emailEvent: EmailEvent.APPOINTMENT_CONFIRMED,
        };
    }
  }

  /**
   * Evaluates user notification preferences:
   * Defaults to true if no preference record exists.
   * Can opt out of APPOINTMENT_REMINDERS or APPOINTMENT_TRANSACTIONAL.
   */
  async canSendEmailToUser(userId: string, eventType: NotificationEventType): Promise<boolean> {
    const category =
      eventType === NotificationEventType.APPOINTMENT_REMINDER_24H ||
      eventType === NotificationEventType.APPOINTMENT_REMINDER_1H
        ? NotificationCategory.APPOINTMENT_REMINDERS
        : NotificationCategory.APPOINTMENT_TRANSACTIONAL;

    const pref = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_category_channel: {
          userId,
          category,
          channel: NotificationChannel.EMAIL,
        },
      },
    });

    if (pref) {
      return pref.enabled;
    }

    // Default to true
    return true;
  }

  /**
   * Watchdog: Recovers rows stuck in PROCESSING for > 5 minutes (worker crashed mid-flight).
   */
  async recoverStaleProcessing(): Promise<number> {
    const result = await this.prisma.$executeRaw`
      UPDATE "NotificationOutbox"
      SET status = 'PENDING'::"OutboxStatus",
          "retryCount" = "retryCount" + 1,
          "lockedBy" = NULL,
          "lockedAt" = NULL
      WHERE status = 'PROCESSING'::"OutboxStatus"
        AND "lockedAt" < NOW() - INTERVAL '5 minutes'
        AND "retryCount" < 3
    `;
    return Number(result);
  }

  /**
   * Safe Data Retention Cleanup:
   * Only deletes PROCESSED outbox records older than retentionDays (default: 30 days).
   * NEVER deletes PENDING, PROCESSING, or FAILED records.
   */
  async safeCleanupOutbox(retentionDays: number = 30): Promise<number> {
    const result = await this.prisma.$executeRaw`
      DELETE FROM "NotificationOutbox"
      WHERE status = 'PROCESSED'::"OutboxStatus"
        AND "processedAt" < NOW() - (${retentionDays} || ' days')::INTERVAL
    `;
    return Number(result);
  }
}
