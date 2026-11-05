import { EmailEvent } from '../constants/email.constants';
import { EmailNotificationStatus } from '@prisma/client';

export interface SendEmailOptions {
  event: EmailEvent;
  recipient: string;
  variables: Record<string, any>;
  userId?: string;
  relatedEntityId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  delayMs?: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailJobData {
  options: SendEmailOptions;
  logId: string;
  attempt: number;
}

export interface SendEmailResult {
  success: boolean;
  logId?: string;
  status?: EmailNotificationStatus | string;
  error?: string;
  skippedReason?: string;
}

