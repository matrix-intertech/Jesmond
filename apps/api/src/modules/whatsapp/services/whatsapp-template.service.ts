import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../constants/whatsapp.constants';
import {
  Msg91ComponentValue,
  WhatsAppTemplateDefinition,
} from '../interfaces/whatsapp.interface';

interface TemplateMetadata {
  defaultName: string;
  requiredVariables: string[];
  description: string;
}

const TEMPLATE_METADATA_MAP: Record<WhatsAppEvent, TemplateMetadata> = {
  [WhatsAppEvent.AUTH_REGISTER_OTP]: {
    defaultName: 'jesmond_auth_register_otp',
    requiredVariables: ['otp'],
    description: 'One-time registration verification passcode for new Jesmond accounts',
  },
  [WhatsAppEvent.AUTH_LOGIN_OTP]: {
    defaultName: 'jesmond_auth_login_otp',
    requiredVariables: ['otp'],
    description: 'One-time login passcode for Jesmond authentication',
  },
  [WhatsAppEvent.AUTH_PASSWORD_RESET_OTP]: {
    defaultName: 'jesmond_auth_password_reset_otp',
    requiredVariables: ['otp'],
    description: 'Password reset verification passcode',
  },
  [WhatsAppEvent.ORDER_CONFIRMED]: {
    defaultName: 'jesmond_order_confirmed',
    requiredVariables: ['order_number', 'customer_name'],
    description: 'Notification when retail or food order is confirmed',
  },
  [WhatsAppEvent.ORDER_PACKED]: {
    defaultName: 'jesmond_order_packed',
    requiredVariables: ['order_number'],
    description: 'Notification when order has been prepared and packed',
  },
  [WhatsAppEvent.ORDER_DELIVERED]: {
    defaultName: 'jesmond_order_delivered',
    requiredVariables: ['order_number'],
    description: 'Notification when order delivery has completed',
  },
  [WhatsAppEvent.ORDER_TAKEN_AWAY]: {
    defaultName: 'jesmond_order_taken_away',
    requiredVariables: ['order_number'],
    description: 'Notification when customer pickup/takeaway is marked completed',
  },
  [WhatsAppEvent.PROPERTY_LISTING_CONFIRMED]: {
    defaultName: 'jesmond_property_listing_confirmed',
    requiredVariables: ['property_title'],
    description: 'Confirmation to host/manager that property listing is published',
  },
  [WhatsAppEvent.PROPERTY_QUERY_RECEIVED]: {
    defaultName: 'jesmond_property_query_received',
    requiredVariables: ['property_title', 'sender_name'],
    description: 'Alert when a prospective resident submits a property query',
  },
  [WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED]: {
    defaultName: 'jesmond_property_message_received',
    requiredVariables: ['property_title', 'sender_name'],
    description: 'Notification of direct message regarding a property',
  },
  [WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED]: {
    defaultName: 'jesmond_appointment_request_received',
    requiredVariables: ['customer_name', 'service_name', 'appointment_time'],
    description: 'Confirmation to customer that appointment request was received',
  },
  [WhatsAppEvent.APPOINTMENT_CONFIRMED]: {
    defaultName: 'jesmond_appointment_confirmed',
    requiredVariables: ['customer_name', 'service_name', 'appointment_time'],
    description: 'Notice to customer that appointment has been confirmed',
  },
  [WhatsAppEvent.APPOINTMENT_REMINDER]: {
    defaultName: 'jesmond_appointment_reminder',
    requiredVariables: ['customer_name', 'service_name', 'appointment_time'],
    description: 'Scheduled reminder sent prior to an upcoming appointment',
  },
  [WhatsAppEvent.APPOINTMENT_CANCELLED]: {
    defaultName: 'jesmond_appointment_cancelled',
    requiredVariables: ['customer_name', 'service_name', 'reason'],
    description: 'Notice of appointment cancellation to customer',
  },
  [WhatsAppEvent.APPOINTMENT_RESCHEDULED]: {
    defaultName: 'jesmond_appointment_rescheduled',
    requiredVariables: [
      'customer_name',
      'service_name',
      'old_time',
      'new_time',
    ],
    description: 'Notice to customer when an appointment time has changed',
  },
  [WhatsAppEvent.SERVICE_PROVIDER_NEW_APPOINTMENT]: {
    defaultName: 'jesmond_sp_new_appointment',
    requiredVariables: ['provider_name', 'service_name', 'appointment_time'],
    description: 'Notice to service provider/business staff for newly booked appointment',
  },
  [WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED]: {
    defaultName: 'jesmond_sp_appointment_confirmed',
    requiredVariables: ['provider_name', 'service_name', 'appointment_time'],
    description: 'Confirmation alert to service provider for confirmed appointment',
  },
  [WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER]: {
    defaultName: 'jesmond_sp_appointment_reminder',
    requiredVariables: ['provider_name', 'service_name', 'appointment_time'],
    description: 'Upcoming appointment reminder for service provider',
  },
  [WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_CANCELLED]: {
    defaultName: 'jesmond_sp_appointment_cancelled',
    requiredVariables: ['provider_name', 'service_name', 'appointment_time'],
    description: 'Cancellation alert dispatched to service provider',
  },
};

@Injectable()
export class WhatsAppTemplateService {
  private readonly logger = new Logger(WhatsAppTemplateService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Resolves the template definition for an event.
   */
  getTemplate(event: WhatsAppEvent): WhatsAppTemplateDefinition | null {
    const meta = TEMPLATE_METADATA_MAP[event];
    if (!meta) {
      this.logger.warn(`Unknown WhatsApp event requested: ${event}`);
      return null;
    }

    // Configurable template identifier: MSG91_TPL_<EVENT>
    const envTemplateName = this.configService.get<string>(
      `MSG91_TPL_${event}`,
    );
    const templateName = envTemplateName || meta.defaultName;

    // Approval status: MSG91_TPL_<EVENT>_STATUS or MSG91_TPL_<EVENT>_APPROVED
    // Default is PENDING_APPROVAL unless explicitly marked approved in environment
    const envStatus = this.configService.get<string>(`MSG91_TPL_${event}_STATUS`);
    const envApproved = this.configService.get<string>(
      `MSG91_TPL_${event}_APPROVED`,
    );

    let status = WhatsAppTemplateStatus.PENDING_APPROVAL;
    if (
      envStatus?.toUpperCase() === WhatsAppTemplateStatus.APPROVED ||
      envApproved === 'true' ||
      envApproved === '1'
    ) {
      status = WhatsAppTemplateStatus.APPROVED;
    }

    const language =
      this.configService.get<string>(`MSG91_TPL_${event}_LANG`) ||
      this.configService.get<string>('MSG91_WHATSAPP_DEFAULT_LANG') ||
      'en';

    const namespace =
      this.configService.get<string>(`MSG91_TPL_${event}_NAMESPACE`) ||
      this.configService.get<string>('MSG91_WHATSAPP_NAMESPACE') ||
      undefined;

    return {
      event,
      templateName,
      status,
      language,
      namespace,
      requiredVariables: meta.requiredVariables,
      description: meta.description,
    };
  }

  /**
   * Checks if a template is approved and ready for dispatch.
   */
  isApproved(event: WhatsAppEvent): boolean {
    const template = this.getTemplate(event);
    return template !== null && template.status === WhatsAppTemplateStatus.APPROVED;
  }

  /**
   * Validates that all required variables for an event are provided.
   */
  validateVariables(
    event: WhatsAppEvent,
    variables?: Record<string, string | number>,
  ): { isValid: boolean; missing: string[] } {
    const template = this.getTemplate(event);
    if (!template) {
      return { isValid: false, missing: ['UNKNOWN_TEMPLATE'] };
    }

    const providedKeys = variables ? Object.keys(variables) : [];
    const missing = template.requiredVariables.filter(
      (req) => !providedKeys.includes(req) && variables?.[req] === undefined,
    );

    return {
      isValid: missing.length === 0,
      missing,
    };
  }

  /**
   * Formats variables into MSG91's components contract:
   * e.g. { body_1: { type: 'text', value: '123456' }, body_2: ... }
   * Accepts both positional / named variables.
   */
  formatComponents(
    event: WhatsAppEvent,
    variables?: Record<string, string | number>,
  ): Record<string, Msg91ComponentValue> {
    if (!variables || Object.keys(variables).length === 0) {
      return {};
    }

    const components: Record<string, Msg91ComponentValue> = {};
    const template = this.getTemplate(event);

    // If variables already use body_1, body_2 format
    const hasBodyKeys = Object.keys(variables).some((k) => k.startsWith('body_'));
    if (hasBodyKeys) {
      for (const [key, val] of Object.entries(variables)) {
        components[key] = {
          type: 'text',
          value: String(val),
        };
      }
      return components;
    }

    // Map according to template's defined required order first, then any extra
    if (template) {
      let index = 1;
      for (const reqVar of template.requiredVariables) {
        if (variables[reqVar] !== undefined) {
          components[`body_${index}`] = {
            type: 'text',
            value: String(variables[reqVar]),
          };
          index++;
        }
      }

      // Add any additional non-required variables passed
      for (const [key, val] of Object.entries(variables)) {
        if (!template.requiredVariables.includes(key)) {
          components[`body_${index}`] = {
            type: 'text',
            value: String(val),
          };
          index++;
        }
      }
    } else {
      let index = 1;
      for (const val of Object.values(variables)) {
        components[`body_${index}`] = {
          type: 'text',
          value: String(val),
        };
        index++;
      }
    }

    return components;
  }

  /**
   * Returns all registered templates and their current resolution status.
   */
  getAllTemplates(): WhatsAppTemplateDefinition[] {
    return Object.values(WhatsAppEvent).map((event) => this.getTemplate(event)!);
  }
}

