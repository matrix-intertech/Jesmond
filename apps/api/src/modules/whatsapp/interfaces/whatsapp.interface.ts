import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../constants/whatsapp.constants';
import { WhatsAppNotificationStatus } from '@prisma/client';

export interface WhatsAppTemplateDefinition {
  event: WhatsAppEvent;
  templateName: string;
  status: WhatsAppTemplateStatus;
  language: string;
  namespace?: string;
  requiredVariables: string[];
  description: string;
}

export interface SendWhatsAppOptions {
  event: WhatsAppEvent;
  recipient: string; // E.164 or Australian national format
  variables?: Record<string, string | number>;
  userId?: string;
  relatedEntityId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  delayMs?: number;
}

export interface Msg91ComponentValue {
  type: 'text';
  value: string;
}

export interface Msg91ToAndComponent {
  to: string[];
  components: Record<string, Msg91ComponentValue>;
}

export interface Msg91Payload {
  integrated_number: string;
  content_type: 'template';
  payload: {
    messaging_product: 'whatsapp';
    type: 'template';
    template: {
      name: string;
      language: {
        code: string;
        policy: 'deterministic';
      };
      namespace?: string;
      to_and_components: Msg91ToAndComponent[];
    };
  };
}

export interface Msg91Response {
  success: boolean;
  messageId?: string;
  statusCode?: number;
  raw?: any;
  error?: string;
}

export interface SendNotificationResult {
  success: boolean;
  logId?: string;
  status: WhatsAppNotificationStatus | 'SKIPPED';
  providerMessageId?: string;
  error?: string;
  skippedReason?: string;
}

export interface WhatsAppJobData extends SendWhatsAppOptions {
  logId?: string;
}

