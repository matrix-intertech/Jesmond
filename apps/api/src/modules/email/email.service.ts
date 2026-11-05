import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  EMAIL_JOB_NAME,
  EMAIL_QUEUE_NAME,
  EmailEvent,
  SECURITY_EMAIL_EVENTS,
} from './constants/email.constants';
import {
  EmailJobData,
  SendEmailOptions,
  SendEmailResult,
} from './interfaces/email.interface';
import { EmailLogService } from './services/email-log.service';
import { EmailTemplateService } from './services/email-template.service';
import { NodemailerProvider } from './providers/nodemailer.provider';
import { AppointmentStatus, EmailNotificationStatus } from '@prisma/client';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: EmailTemplateService,
    private readonly logService: EmailLogService,
    private readonly mailerProvider: NodemailerProvider,
    @Optional()
    @InjectQueue(EMAIL_QUEUE_NAME)
    private readonly emailQueue?: Queue<EmailJobData>,
  ) {}

  /**
   * Checks whether the recipient user has consented to transactional email notifications.
   * Security OTP events (AUTH_REGISTER_OTP, AUTH_LOGIN_OTP, AUTH_PASSWORD_RESET_OTP)
   * bypass consent checks so users are never locked out of verification flows.
   */
  async canSendToUser(userId: string, event: EmailEvent): Promise<boolean> {
    if (SECURITY_EMAIL_EVENTS.has(event)) {
      return true;
    }

    if (!userId) {
      return true;
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { emailNotifications: true },
      });

      if (!user) return true;
      return user.emailNotifications !== false;
    } catch (err: any) {
      this.logger.warn(
        `Failed to query user email preferences for ${userId}: ${err.message}. Defaulting to true.`,
      );
      return true;
    }
  }

  /**
   * Synchronous / direct dispatch of an email notification.
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const {
      event,
      recipient,
      variables,
      userId,
      relatedEntityId,
      idempotencyKey,
      metadata,
    } = options;

    // 1. Consent check
    if (userId) {
      const hasConsent = await this.canSendToUser(userId, event);
      if (!hasConsent) {
        this.logger.log(
          `User ${userId} has opted out of email notifications. Skipping event "${event}".`,
        );
        return {
          success: false,
          status: 'SKIPPED',
          skippedReason: 'USER_OPTED_OUT',
        };
      }
    }

    // 2. Idempotency check
    if (idempotencyKey) {
      const existing = await this.logService.findByIdempotencyKey(
        idempotencyKey,
      );
      if (
        existing &&
        (existing.status === EmailNotificationStatus.SENT ||
          existing.status === EmailNotificationStatus.QUEUED)
      ) {
        this.logger.log(
          `Idempotent duplicate detected for key "${idempotencyKey}". Skipping email delivery.`,
        );
        return {
          success: true,
          logId: existing.id,
          status: existing.status,
        };
      }
    }

    // 3. Render template
    let rendered;
    try {
      rendered = this.templateService.render(event, variables);
    } catch (err: any) {
      this.logger.error(`Template rendering failed for "${event}": ${err.message}`);
      return {
        success: false,
        status: EmailNotificationStatus.FAILED,
        error: err.message,
      };
    }

    // 4. Create initial log
    let log;
    try {
      log = await this.logService.createLog({
        eventType: event,
        recipient,
        subject: rendered.subject,
        userId,
        relatedEntityId,
        idempotencyKey,
        metadata,
        status: EmailNotificationStatus.PENDING,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create email log: ${err.message}`);
    }

    // 5. Dispatch via Nodemailer provider
    const result = await this.mailerProvider.sendMail({
      to: recipient,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    if (result.success) {
      if (log) {
        await this.logService.updateSuccess(log.id, {
          messageId: result.messageId,
        });
      }
      return {
        success: true,
        logId: log?.id,
        status: EmailNotificationStatus.SENT,
      };
    } else {
      const errorMsg = result.error || 'Nodemailer dispatch failure';
      if (log) {
        await this.logService.updateFailure(log.id, errorMsg, false);
      }
      return {
        success: false,
        logId: log?.id,
        status: EmailNotificationStatus.FAILED,
        error: errorMsg,
      };
    }
  }

  /**
   * Asynchronous non-blocking dispatch using Redis Queue (BullMQ) with graceful fallback.
   * Operations like bookings, orders, and authentication will never be blocked by email dispatch.
   */
  async sendEmailAsync(options: SendEmailOptions): Promise<SendEmailResult> {
    const {
      event,
      recipient,
      userId,
      relatedEntityId,
      idempotencyKey,
      metadata,
      delayMs,
    } = options;

    // Fast-path consent check
    if (userId) {
      const hasConsent = await this.canSendToUser(userId, event);
      if (!hasConsent) {
        return {
          success: false,
          status: 'SKIPPED',
          skippedReason: 'USER_OPTED_OUT',
        };
      }
    }

    // Upfront idempotency check
    if (idempotencyKey) {
      const existing = await this.logService.findByIdempotencyKey(
        idempotencyKey,
      );
      if (
        existing &&
        (existing.status === EmailNotificationStatus.SENT ||
          existing.status === EmailNotificationStatus.QUEUED)
      ) {
        return {
          success: true,
          logId: existing.id,
          status: existing.status,
        };
      }
    }

    // Initial log creation with QUEUED status
    let log;
    try {
      const template = this.templateService.getTemplate(event);
      const subject = template.subject(options.variables || {});
      log = await this.logService.createLog({
        eventType: event,
        recipient,
        subject,
        userId,
        relatedEntityId,
        idempotencyKey,
        metadata,
        status: EmailNotificationStatus.QUEUED,
      });
    } catch {
      // Non-blocking log creation fallback
    }

    // Enqueue in BullMQ if queue is available
    if (this.emailQueue) {
      try {
        await this.emailQueue.add(
          EMAIL_JOB_NAME,
          {
            options,
            logId: log?.id || '',
            attempt: 1,
          },
          {
            jobId: idempotencyKey || undefined,
            delay: delayMs || undefined,
          },
        );

        return {
          success: true,
          logId: log?.id,
          status: EmailNotificationStatus.QUEUED,
        };
      } catch (queueErr: any) {
        this.logger.warn(
          `Email BullMQ queue failed (${queueErr.message}); falling back to asynchronous direct dispatch.`,
        );
      }
    }

    // Non-durable in-process fallback if BullMQ/Redis is unavailable.
    // Note: Pending in-memory timeouts will not survive process restarts.
    // If a restart occurs, records remain observable in Postgres with QUEUED status.
    const delay = delayMs || 0;
    setTimeout(() => {
      this.sendEmail(options).catch((err) =>
        this.logger.error(`Fallback async email dispatch error: ${err.message}`),
      );
    }, Math.min(delay, 2147483647));

    return {
      success: true,
      logId: log?.id,
      status: EmailNotificationStatus.QUEUED,
    };
  }

  /**
   * Process a job from BullMQ worker.
   */
  async executeQueuedEmail(jobData: EmailJobData): Promise<SendEmailResult> {
    const { options, logId } = jobData;
    const { event, recipient, variables } = options;

    // Verify appointment status for reminder events
    if (
      event === EmailEvent.APPOINTMENT_REMINDER ||
      event === EmailEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER
    ) {
      const appointmentId = options.relatedEntityId;
      if (!appointmentId) {
        this.logger.warn(
          'Skipping appointment reminder: missing relatedEntityId in job data.',
        );
        if (logId) {
          await this.logService.updateSkipped(
            logId,
            'Missing appointment relatedEntityId',
          );
        }
        return {
          success: false,
          status: EmailNotificationStatus.SKIPPED,
          skippedReason: 'MISSING_APPOINTMENT_ID',
        };
      }

      try {
        const appointment = await this.prisma.appointment.findUnique({
          where: { id: appointmentId },
          select: { id: true, status: true },
        });

        if (!appointment) {
          this.logger.warn(
            `Skipping appointment reminder: appointment ${appointmentId} not found.`,
          );
          if (logId) {
            await this.logService.updateSkipped(
              logId,
              `Appointment ${appointmentId} not found`,
            );
          }
          return {
            success: false,
            status: EmailNotificationStatus.SKIPPED,
            skippedReason: 'APPOINTMENT_NOT_FOUND',
          };
        }

        if (appointment.status !== AppointmentStatus.CONFIRMED) {
          this.logger.log(
            `Skipping appointment reminder: appointment ${appointmentId} has status "${appointment.status}" (must be CONFIRMED).`,
          );
          if (logId) {
            await this.logService.updateSkipped(
              logId,
              `Appointment not confirmed (status: ${appointment.status})`,
            );
          }
          return {
            success: false,
            status: EmailNotificationStatus.SKIPPED,
            skippedReason: `APPOINTMENT_STATUS_${appointment.status}`,
          };
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to verify appointment status for reminder: ${err.message}`,
        );
        throw err;
      }
    }

    try {
      const rendered = this.templateService.render(event, variables);
      const result = await this.mailerProvider.sendMail({
        to: recipient,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });

      if (result.success) {
        if (logId) {
          await this.logService.updateSuccess(logId, {
            messageId: result.messageId,
          });
        }
        return { success: true, logId, status: EmailNotificationStatus.SENT };
      } else {
        const errorMsg = result.error || 'Nodemailer dispatch failure';
        if (logId) {
          await this.logService.updateFailure(logId, errorMsg, true);
        }
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      if (logId) {
        await this.logService.updateFailure(logId, err.message, true);
      }
      throw err;
    }
  }

  /**
   * Cancels a scheduled delayed job in the BullMQ queue by job ID.
   */
  async cancelScheduledJob(jobId: string): Promise<boolean> {
    if (!this.emailQueue) return false;
    try {
      const log = await this.logService.findByIdempotencyKey(jobId);
      if (log && log.status === EmailNotificationStatus.QUEUED) {
        await this.logService.updateSkipped(log.id, 'Job cancelled');
      }

      const job = await this.emailQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Cancelled delayed email job ${jobId}`);
        return true;
      }
      return false;
    } catch (err: any) {
      this.logger.warn(`Failed to cancel email job ${jobId}: ${err.message}`);
      return false;
    }
  }
}

