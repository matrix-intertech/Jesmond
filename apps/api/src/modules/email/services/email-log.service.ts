import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailNotificationStatus, EmailNotificationLog } from '@prisma/client';
import { EmailEvent } from '../constants/email.constants';

export interface CreateEmailLogParams {
  eventType: EmailEvent;
  recipient: string;
  subject: string;
  userId?: string;
  relatedEntityId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  status?: EmailNotificationStatus;
}

@Injectable()
export class EmailLogService {
  private readonly logger = new Logger(EmailLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sanitizes metadata to guarantee OTPs, passwords, and tokens are never logged.
   */
  private sanitizeMetadata(
    metadata?: Record<string, any>,
  ): Record<string, any> | undefined {
    if (!metadata) return undefined;
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (
        /otp|password|token|secret|authorization|key/i.test(key)
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Finds a notification log by its idempotency key.
   */
  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<EmailNotificationLog | null> {
    try {
      return await this.prisma.emailNotificationLog.findUnique({
        where: { idempotencyKey },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to query email log by idempotencyKey: ${err.message}`);
      return null;
    }
  }

  /**
   * Creates an initial email notification log entry.
   */
  async createLog(params: CreateEmailLogParams): Promise<EmailNotificationLog> {
    const {
      eventType,
      recipient,
      subject,
      userId,
      relatedEntityId,
      idempotencyKey,
      metadata,
      status = EmailNotificationStatus.PENDING,
    } = params;

    const sanitizedMeta = this.sanitizeMetadata(metadata);

    return this.prisma.emailNotificationLog.create({
      data: {
        eventType,
        recipient,
        subject,
        userId,
        relatedEntityId,
        idempotencyKey,
        metadata: sanitizedMeta,
        status,
        attemptCount: 1,
      },
    });
  }

  /**
   * Updates an email log to SENT.
   */
  async updateSuccess(
    id: string,
    metadata?: Record<string, any>,
  ): Promise<EmailNotificationLog> {
    const sanitizedMeta = this.sanitizeMetadata(metadata);
    return this.prisma.emailNotificationLog.update({
      where: { id },
      data: {
        status: EmailNotificationStatus.SENT,
        failureReason: null,
        ...(sanitizedMeta ? { metadata: sanitizedMeta } : {}),
      },
    });
  }

  /**
   * Updates an email log to FAILED and records the failure reason.
   */
  async updateFailure(
    id: string,
    failureReason: string,
    canRetry = false,
  ): Promise<EmailNotificationLog> {
    return this.prisma.emailNotificationLog.update({
      where: { id },
      data: {
        status: canRetry
          ? EmailNotificationStatus.PENDING
          : EmailNotificationStatus.FAILED,
        failureReason: failureReason.slice(0, 1000),
        attemptCount: { increment: 1 },
      },
    });
  }

  /**
   * Updates an email log to SKIPPED.
   */
  async updateSkipped(
    id: string,
    reason: string,
  ): Promise<EmailNotificationLog> {
    return this.prisma.emailNotificationLog.update({
      where: { id },
      data: {
        status: EmailNotificationStatus.SKIPPED,
        failureReason: reason,
      },
    });
  }
}

