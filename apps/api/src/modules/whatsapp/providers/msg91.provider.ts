import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AU_MOBILE_REGEX,
  DEFAULT_HTTP_TIMEOUT_MS,
  DEFAULT_MSG91_BASE_URL,
  E164_PHONE_REGEX,
} from '../constants/whatsapp.constants';
import {
  Msg91ComponentValue,
  Msg91Payload,
  Msg91Response,
  WhatsAppTemplateDefinition,
} from '../interfaces/whatsapp.interface';

@Injectable()
export class Msg91Provider {
  private readonly logger = new Logger(Msg91Provider.name);

  constructor(private readonly configService: ConfigService) {}

  public isEnabled(): boolean {
    const enabled = this.configService.get<string>('MSG91_WHATSAPP_ENABLED');
    return enabled === 'true' || enabled === '1';
  }

  public isConfigured(): boolean {
    const authKey = this.getAuthKey();
    const sender = this.getSenderNumber();
    return Boolean(authKey && sender);
  }

  public getAuthKey(): string | undefined {
    return this.configService.get<string>('MSG91_AUTH_KEY');
  }

  public getSenderNumber(): string | undefined {
    const sender = this.configService.get<string>('MSG91_WHATSAPP_SENDER');
    if (!sender) return undefined;
    return this.normalizePhoneNumber(sender).normalized;
  }

  public getBaseUrl(): string {
    return (
      this.configService.get<string>('MSG91_WHATSAPP_BASE_URL') ||
      DEFAULT_MSG91_BASE_URL
    );
  }

  public getTimeoutMs(): number {
    const t = this.configService.get<string>('MSG91_TIMEOUT_MS');
    return t ? parseInt(t, 10) : DEFAULT_HTTP_TIMEOUT_MS;
  }

  /**
   * Normalizes and validates phone numbers.
   * Converts Australian numbers (04... / +614...) to standard MSG91 format (614...).
   * Validates international numbers against E.164.
   */
  public normalizePhoneNumber(phone: string): {
    normalized: string;
    isValid: boolean;
    reason?: string;
  } {
    if (!phone || typeof phone !== 'string') {
      return { normalized: '', isValid: false, reason: 'Phone number is required' };
    }

    // Strip whitespaces, hyphens, brackets
    let cleaned = phone.replace(/[\s\-()]/g, '');

    // Australian domestic mobile format (e.g., 0412345678 -> 61412345678)
    if (/^04\d{8}$/.test(cleaned)) {
      cleaned = '61' + cleaned.substring(1);
    } else if (/^\+614\d{8}$/.test(cleaned)) {
      cleaned = cleaned.substring(1); // remove '+'
    } else if (/^\+/.test(cleaned)) {
      cleaned = cleaned.substring(1); // remove '+' for international
    }

    // Validate: must be numeric and match E.164 length (8 to 15 digits)
    if (!/^\d{8,15}$/.test(cleaned)) {
      return {
        normalized: cleaned,
        isValid: false,
        reason: `Invalid phone format: ${phone}. Expected valid Australian or E.164 phone number.`,
      };
    }

    return {
      normalized: cleaned,
      isValid: true,
    };
  }

  /**
   * Sends an approved template message via MSG91 WhatsApp Outbound API.
   */
  async sendTemplateMessage(params: {
    recipient: string;
    template: WhatsAppTemplateDefinition;
    components: Record<string, Msg91ComponentValue>;
  }): Promise<Msg91Response> {
    const { recipient, template, components } = params;

    // Check configuration
    if (!this.isConfigured()) {
      const err = 'MSG91 WhatsApp provider is not configured (missing auth key or sender)';
      this.logger.error(err);
      return {
        success: false,
        error: err,
      };
    }

    // Check enabled status
    if (!this.isEnabled()) {
      this.logger.log(
        `MSG91 WhatsApp is disabled (MSG91_WHATSAPP_ENABLED=false). Mocking send for template ${template.templateName} to ${recipient}`,
      );
      return {
        success: true,
        messageId: `MOCK_DISABLED_${Date.now()}`,
        raw: { mocked: true, reason: 'MSG91_WHATSAPP_ENABLED_FALSE' },
      };
    }

    // Validate recipient
    const norm = this.normalizePhoneNumber(recipient);
    if (!norm.isValid) {
      this.logger.warn(`Rejected invalid recipient phone number: ${norm.reason}`);
      return {
        success: false,
        error: norm.reason,
      };
    }

    const senderNumber = this.getSenderNumber()!;
    const authKey = this.getAuthKey()!;
    const baseUrl = this.getBaseUrl();
    const timeoutMs = this.getTimeoutMs();

    // Construct MSG91 WhatsApp v5 payload
    const payload: Msg91Payload = {
      integrated_number: senderNumber,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: template.templateName,
          language: {
            code: template.language,
            policy: 'deterministic',
          },
          ...(template.namespace ? { namespace: template.namespace } : {}),
          to_and_components: [
            {
              to: [norm.normalized],
              components,
            },
          ],
        },
      },
    };

    // Safe debug logging (credential masked)
    const maskedAuth = authKey ? `${authKey.substring(0, 4)}***` : 'NOT_SET';
    this.logger.debug(
      `Dispatching WhatsApp template "${template.templateName}" to ${norm.normalized} (sender: ${senderNumber}, auth: ${maskedAuth})`,
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          authkey: authKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      let responseData: any;
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = { raw: text };
      }

      if (!response.ok) {
        const errorMsg =
          responseData?.message ||
          responseData?.error ||
          `MSG91 HTTP Error ${response.status}: ${response.statusText}`;
        this.logger.error(
          `MSG91 request failed with status ${response.status}: ${errorMsg}`,
        );
        return {
          success: false,
          statusCode: response.status,
          error: errorMsg,
          raw: responseData,
        };
      }

      // Check MSG91 JSON-level status
      const isSuccess =
        responseData?.status === 'success' ||
        responseData?.type === 'success' ||
        Boolean(responseData?.message_id || responseData?.request_id);

      const messageId =
        responseData?.message_id ||
        responseData?.request_id ||
        responseData?.data?.request_id ||
        responseData?.data?.message_id;

      if (!isSuccess && responseData?.status === 'error') {
        const errorMsg =
          responseData?.message ||
          responseData?.error ||
          'MSG91 returned status: error';
        return {
          success: false,
          statusCode: response.status,
          error: errorMsg,
          raw: responseData,
        };
      }

      return {
        success: true,
        messageId: messageId ? String(messageId) : undefined,
        statusCode: response.status,
        raw: responseData,
      };
    } catch (err: any) {
      clearTimeout(timer);

      if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
        const timeoutError = `MSG91 WhatsApp API request timed out after ${timeoutMs}ms`;
        this.logger.error(timeoutError);
        return {
          success: false,
          error: timeoutError,
        };
      }

      const connectionError = `Failed to connect to MSG91 WhatsApp API: ${err.message}`;
      this.logger.error(connectionError);
      return {
        success: false,
        error: connectionError,
      };
    }
  }
}

