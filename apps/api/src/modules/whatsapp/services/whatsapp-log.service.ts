import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppNotificationLog, WhatsAppNotificationStatus } from '@prisma/client';
import { SENSITIVE_FIELD_PATTERNS } from '../constants/whatsapp.constants';

@Injectable()
export class WhatsAppLogService {
  private readonly logger = new Logger(WhatsAppLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deeply cleans metadata to guarantee no OTPs, passwords, or secrets are persisted.
   */
  public sanitizeMetadata(
    obj: Record<string, any> | undefined | null,
  ): Record<string, any> | undefined {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const isSensitive = SENSITIVE_FIELD_PATTERNS.some((pattern) =>
        pattern.test(key),
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? this.sanitizeMetadata(item)
            : item,
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  async createLog(data: {
    eventType: string;
    recipient: string;
    templateId: string;
    userId?: string;
    relatedEntityId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, any>;
    status?: WhatsAppNotificationStatus;
  }): Promise<WhatsAppNotificationLog> {
    const cleanMetadata = this.sanitizeMetadata(data.metadata);

    return this.prisma.whatsAppNotificationLog.create({
      data: {
        eventType: data.eventType,
        recipient: data.recipient,
        templateId: data.templateId,
        userId: data.userId || null,
        relatedEntityId: data.relatedEntityId || null,
        idempotencyKey: data.idempotencyKey || null,
        metadata: cleanMetadata ?? undefined,
        status: data.status || WhatsAppNotificationStatus.PENDING,
        attemptCount: 1,
      },
    });
  }

  async updateSuccess(
    id: string,
    providerMessageId?: string,
  ): Promise<WhatsAppNotificationLog> {
    return this.prisma.whatsAppNotificationLog.update({
      where: { id },
      data: {
        status: WhatsAppNotificationStatus.SENT,
        providerMessageId: providerMessageId || null,
        failureReason: null,
      },
    });
  }

  async updateFailure(
    id: string,
    failureReason: string,
    incrementAttempt = false,
    finalFailure = false,
  ): Promise<WhatsAppNotificationLog> {
    return this.prisma.whatsAppNotificationLog.update({
      where: { id },
      data: {
        status: finalFailure
          ? WhatsAppNotificationStatus.FAILED
          : WhatsAppNotificationStatus.PENDING,
        failureReason: failureReason.slice(0, 1000),
        attemptCount: incrementAttempt ? { increment: 1 } : undefined,
      },
    });
  }

  async findByIdempotencyKey(
    key: string,
  ): Promise<WhatsAppNotificationLog | null> {
    if (!key) return null;
    return this.prisma.whatsAppNotificationLog.findUnique({
      where: { idempotencyKey: key },
    });
  }

  async findById(id: string): Promise<WhatsAppNotificationLog | null> {
    return this.prisma.whatsAppNotificationLog.findUnique({
      where: { id },
    });
  }

  async queryLogs(params: {
    eventType?: string;
    status?: WhatsAppNotificationStatus;
    recipient?: string;
    relatedEntityId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.eventType) where.eventType = params.eventType;
    if (params.status) where.status = params.status;
    if (params.recipient) where.recipient = { contains: params.recipient };
    if (params.relatedEntityId) where.relatedEntityId = params.relatedEntityId;

    const [data, total] = await Promise.all([
      this.prisma.whatsAppNotificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.whatsAppNotificationLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
