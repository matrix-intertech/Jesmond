import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  WHATSAPP_JOB_NAME,
  WHATSAPP_QUEUE_NAME,
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from './constants/whatsapp.constants';
import {
  SendNotificationResult,
  SendWhatsAppOptions,
  WhatsAppJobData,
} from './interfaces/whatsapp.interface';
import { Msg91Provider } from './providers/msg91.provider';
import { WhatsAppLogService } from './services/whatsapp-log.service';
import { WhatsAppTemplateService } from './services/whatsapp-template.service';
import { WhatsAppNotificationStatus } from '@prisma/client';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly msg91Provider: Msg91Provider,
    private readonly templateService: WhatsAppTemplateService,
    private readonly logService: WhatsAppLogService,
    @Optional()
    @InjectQueue(WHATSAPP_QUEUE_NAME)
    private readonly whatsappQueue?: Queue<WhatsAppJobData>,
  ) {}

  /**
   * Checks whether the user has consented to receiving WhatsApp notifications.
   */
  async canSendToUser(userId: string): Promise<boolean> {
    if (!userId) return true;

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { whatsappNotifications: true },
      });

      if (!user) return true;
      return user.whatsappNotifications !== false;
    } catch (err: any) {
      this.logger.warn(
        `Failed to query user consent for ${userId}: ${err.message}. Defaulting to true.`,
      );
      return true;
    }
  }

  /**
   * Synchronous / direct dispatch of a WhatsApp notification.
   */
  async sendNotification(
    options: SendWhatsAppOptions,
  ): Promise<SendNotificationResult> {
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
      const hasConsent = await this.canSendToUser(userId);
      if (!hasConsent) {
        this.logger.log(
          `User ${userId} has opted out of WhatsApp notifications. Skipping ${event}.`,
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
        (existing.status === WhatsAppNotificationStatus.SENT ||
          existing.status === WhatsAppNotificationStatus.DELIVERED)
      ) {
        this.logger.log(
          `Idempotent duplicate detected for key "${idempotencyKey}". Skipping delivery.`,
        );
        return {
          success: true,
          logId: existing.id,
          status: existing.status,
          providerMessageId: existing.providerMessageId || undefined,
        };
      }
    }

    // 3. Template validation
    const template = this.templateService.getTemplate(event);
    if (!template) {
      const errorMsg = `No template definition found for event "${event}".`;
      this.logger.error(errorMsg);
      const log = await this.logService.createLog({
        eventType: event,
        recipient,
        templateId: 'UNKNOWN',
        userId,
        relatedEntityId,
        idempotencyKey,
        metadata,
        status: WhatsAppNotificationStatus.FAILED,
      });
      await this.logService.updateFailure(log.id, errorMsg, false, true);
      return {
        success: false,
        logId: log.id,
        status: WhatsAppNotificationStatus.FAILED,
        error: errorMsg,
      };
    }

    if (template.status !== WhatsAppTemplateStatus.APPROVED) {
      const errorMsg = `Template "${template.templateName}" for event "${event}" is not approved (status: ${template.status}). Dispatches are strictly prohibited until approved.`;
      this.logger.warn(errorMsg);
      const log = await this.logService.createLog({
        eventType: event,
        recipient,
        templateId: template.templateName,
        userId,
        relatedEntityId,
        idempotencyKey,
        metadata,
        status: WhatsAppNotificationStatus.FAILED,
      });
      await this.logService.updateFailure(log.id, errorMsg, false, true);
      return {
        success: false,
        logId: log.id,
        status: WhatsAppNotificationStatus.FAILED,
        error: errorMsg,
      };
    }

    // 4. Variable validation
    const varCheck = this.templateService.validateVariables(event, variables);
    if (!varCheck.isValid) {
      const errorMsg = `Missing required variables for event "${event}": ${varCheck.missing.join(', ')}`;
      this.logger.error(errorMsg);
      const log = await this.logService.createLog({
        eventType: event,
        recipient,
        templateId: template.templateName,
        userId,
        relatedEntityId,
        idempotencyKey,
        metadata,
        status: WhatsAppNotificationStatus.FAILED,
      });
      await this.logService.updateFailure(log.id, errorMsg, false, true);
      return {
        success: false,
        logId: log.id,
        status: WhatsAppNotificationStatus.FAILED,
        error: errorMsg,
      };
    }

    // 5. Phone validation
    const normPhone = this.msg91Provider.normalizePhoneNumber(recipient);
    if (!normPhone.isValid) {
      const errorMsg = normPhone.reason || 'Invalid phone format';
      this.logger.error(errorMsg);
      const log = await this.logService.createLog({
        eventType: event,
        recipient,
        templateId: template.templateName,
        userId,
        relatedEntityId,
        idempotencyKey,
        metadata,
        status: WhatsAppNotificationStatus.FAILED,
      });
      await this.logService.updateFailure(log.id, errorMsg, false, true);
      return {
        success: false,
        logId: log.id,
        status: WhatsAppNotificationStatus.FAILED,
        error: errorMsg,
      };
    }

    // 6. Create initial log
    const log = await this.logService.createLog({
      eventType: event,
      recipient: normPhone.normalized,
      templateId: template.templateName,
      userId,
      relatedEntityId,
      idempotencyKey,
      metadata,
      status: WhatsAppNotificationStatus.PENDING,
    });

    // 7. Dispatch via MSG91
    const components = this.templateService.formatComponents(event, variables);
    const providerResult = await this.msg91Provider.sendTemplateMessage({
      recipient: normPhone.normalized,
      template,
      components,
    });

    if (providerResult.success) {
      await this.logService.updateSuccess(
        log.id,
        providerResult.messageId,
      );
      return {
        success: true,
        logId: log.id,
        status: WhatsAppNotificationStatus.SENT,
        providerMessageId: providerResult.messageId,
      };
    } else {
      const failureReason =
        providerResult.error || 'Unknown MSG91 provider dispatch failure';
      await this.logService.updateFailure(
        log.id,
        failureReason,
        false,
        true,
      );
      return {
        success: false,
        logId: log.id,
        status: WhatsAppNotificationStatus.FAILED,
        error: failureReason,
      };
    }
  }

  /**
   * Asynchronous non-blocking dispatch using Redis Queue (BullMQ) with graceful fallback.
   * Order, property, and appointment transactions will never be blocked.
   */
  async sendNotificationAsync(
    options: SendWhatsAppOptions,
  ): Promise<SendNotificationResult> {
    const { event, recipient, userId, relatedEntityId, idempotencyKey, metadata, delayMs } =
      options;

    // Fast-path consent check
    if (userId) {
      const hasConsent = await this.canSendToUser(userId);
      if (!hasConsent) {
        return {
          success: false,
          status: 'SKIPPED',
          skippedReason: 'USER_OPTED_OUT',
        };
      }
    }

    // Check idempotency upfront
    if (idempotencyKey) {
      const existing = await this.logService.findByIdempotencyKey(
        idempotencyKey,
      );
      if (
        existing &&
        (existing.status === WhatsAppNotificationStatus.SENT ||
          existing.status === WhatsAppNotificationStatus.DELIVERED)
      ) {
        return {
          success: true,
          logId: existing.id,
          status: existing.status,
          providerMessageId: existing.providerMessageId || undefined,
        };
      }
    }

    const template = this.templateService.getTemplate(event);
    const templateId = template?.templateName || 'UNKNOWN';

    // Create queued log record
    const log = await this.logService.createLog({
      eventType: event,
      recipient,
      templateId,
      userId,
      relatedEntityId,
      idempotencyKey,
      metadata,
      status: WhatsAppNotificationStatus.QUEUED,
    });

    const jobData: WhatsAppJobData = {
      ...options,
      logId: log.id,
    };

    // If queue is available, enqueue
    if (this.whatsappQueue) {
      try {
        await this.whatsappQueue.add(WHATSAPP_JOB_NAME, jobData, {
          jobId: idempotencyKey || `wa_${log.id}`,
          delay: delayMs && delayMs > 0 ? delayMs : undefined,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        });

        return {
          success: true,
          logId: log.id,
          status: WhatsAppNotificationStatus.QUEUED,
        };
      } catch (queueErr: any) {
        this.logger.warn(
          `BullMQ enqueue failed: ${queueErr.message}. Executing async direct fallback.`,
        );
      }
    }

    // Graceful background fallback: do not await, never block caller
    setImmediate(async () => {
      try {
        await this.executeDelivery(jobData, 1);
      } catch (err: any) {
        this.logger.error(
          `Async fallback delivery failed for log ${log.id}: ${err.message}`,
        );
      }
    });

    return {
      success: true,
      logId: log.id,
      status: WhatsAppNotificationStatus.QUEUED,
    };
  }

  /**
   * Internal worker execution method used by BullMQ worker and fallback.
   */
  
  /**
   * Cancels a scheduled/delayed job by its BullMQ jobId.
   */
  async cancelScheduledJob(jobId: string): Promise<boolean> {
    if (!this.whatsappQueue || !jobId) return false;
    try {
      const job = await this.whatsappQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Cancelled scheduled WhatsApp notification job "${jobId}"`);
        return true;
      }
    } catch (err: any) {
      this.logger.warn(`Failed to cancel job "${jobId}": ${err.message}`);
    }
    return false;
  }

  async executeDelivery(
    data: WhatsAppJobData,
    attemptNumber: number,
  ): Promise<SendNotificationResult> {
    const { event, recipient, variables, logId } = data;

    const template = this.templateService.getTemplate(event);
    if (!template) {
      const err = `Template missing for event ${event}`;
      if (logId) await this.logService.updateFailure(logId, err, true, true);
      throw new Error(err);
    }

    if (template.status !== WhatsAppTemplateStatus.APPROVED) {
      const err = `Template "${template.templateName}" is pending approval.`;
      if (logId) await this.logService.updateFailure(logId, err, false, true);
      throw new Error(err); // Fatal, non-retryable
    }

    const varCheck = this.templateService.validateVariables(event, variables);
    if (!varCheck.isValid) {
      const err = `Missing required variables: ${varCheck.missing.join(', ')}`;
      if (logId) await this.logService.updateFailure(logId, err, false, true);
      throw new Error(err);
    }

    const normPhone = this.msg91Provider.normalizePhoneNumber(recipient);
    if (!normPhone.isValid) {
      const err = normPhone.reason || 'Invalid phone format';
      if (logId) await this.logService.updateFailure(logId, err, false, true);
      throw new Error(err);
    }

    const components = this.templateService.formatComponents(event, variables);
    const result = await this.msg91Provider.sendTemplateMessage({
      recipient: normPhone.normalized,
      template,
      components,
    });

    if (result.success) {
      if (logId) {
        await this.logService.updateSuccess(logId, result.messageId);
      }
      return {
        success: true,
        logId,
        status: WhatsAppNotificationStatus.SENT,
        providerMessageId: result.messageId,
      };
    } else {
      const failureReason = result.error || 'Provider dispatch failed';
      if (logId) {
        await this.logService.updateFailure(
          logId,
          failureReason,
          true,
          attemptNumber >= 3,
        );
      }
      throw new Error(failureReason);
    }
  }
}

