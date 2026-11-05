import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { WhatsAppTemplateService } from '../../whatsapp/services/whatsapp-template.service';
import { Msg91Provider } from '../../whatsapp/providers/msg91.provider';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../../whatsapp/constants/whatsapp.constants';

export interface WhatsAppOtpResult {
  sent: boolean;
  channel: 'whatsapp';
  reason?: string;
}

/**
 * Thin orchestrator for WhatsApp OTP delivery in auth flows.
 *
 * Responsibilities:
 * - Normalize the recipient phone number (countryCode + phone → E.164)
 * - Check template approval before attempting delivery
 * - Delegate to WhatsAppService.sendNotificationAsync() (fire-and-forget)
 *
 * This service NEVER:
 * - Stores OTP plaintext
 * - Passes OTP in log metadata
 * - Blocks auth transactions (all calls are fire-and-forget)
 * - Gates authentication success on WhatsApp delivery
 */
@Injectable()
export class WhatsAppAuthOtpService {
  private readonly logger = new Logger(WhatsAppAuthOtpService.name);

  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly templateService: WhatsAppTemplateService,
    private readonly msg91Provider: Msg91Provider,
  ) {}

  /**
   * Builds and normalizes a phone number from separate countryCode and phone fields.
   * Returns null if the result is invalid.
   */
  private buildRecipient(
    countryCode: string | null,
    phone: string | null,
  ): string | null {
    if (!phone) return null;

    // Combine countryCode + phone, stripping leading zeros on the local number
    // e.g., countryCode='61', phone='0412345678' → '610412345678' → after normalize: '61412345678'
    // e.g., countryCode='+61', phone='412345678' → '+61412345678' → after normalize: '61412345678'
    const combined = countryCode
      ? `${countryCode}${phone}`.replace(/\s/g, '')
      : phone.replace(/\s/g, '');

    const { normalized, isValid, reason } =
      this.msg91Provider.normalizePhoneNumber(combined);

    if (!isValid) {
      this.logger.warn(`WhatsApp OTP: invalid phone number. ${reason}`);
      return null;
    }

    return normalized;
  }

  /**
   * Checks whether the template for a given event is approved before attempting delivery.
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
   * Core internal dispatch method.
   * Always fire-and-forget — never awaited by callers.
   */
  private async dispatchOtp(
    event: WhatsAppEvent,
    userId: string,
    countryCode: string | null,
    phone: string | null,
    // NOTE: otp variable name is intentional — it is passed as a template variable
    // but NEVER stored in log metadata (WhatsAppService.sendNotificationAsync sanitizes it)
    otpValue: string,
  ): Promise<WhatsAppOtpResult> {
    // 1. Validate phone
    const recipient = this.buildRecipient(countryCode, phone);
    if (!recipient) {
      return {
        sent: false,
        channel: 'whatsapp',
        reason: 'Invalid or missing phone number — WhatsApp OTP skipped',
      };
    }

    // 2. Check template approval
    if (!this.isTemplateApproved(event)) {
      this.logger.warn(
        `WhatsApp OTP template for ${event} is pending approval. Skipping delivery for user ${userId}.`,
      );
      return {
        sent: false,
        channel: 'whatsapp',
        reason: `Template for ${event} is pending MSG91/Meta approval`,
      };
    }

    // 3. Dispatch (fire-and-forget within the outer caller — this method still returns a result)
    try {
      await this.whatsAppService.sendNotificationAsync({
        event,
        recipient,
        userId,
        // Template variables — the WhatsAppLogService.sanitizeMetadata() will strip
        // the 'otp' key from stored metadata automatically via SENSITIVE_FIELD_PATTERNS
        variables: { otp: otpValue },
        idempotencyKey: `wa_otp_${event}_${userId}_${Date.now()}`,
      });

      return { sent: true, channel: 'whatsapp' };
    } catch (err: any) {
      this.logger.warn(
        `WhatsApp OTP enqueue failed for event ${event}, user ${userId}: ${err.message}`,
      );
      return { sent: false, channel: 'whatsapp', reason: err.message };
    }
  }

  /**
   * Send WhatsApp OTP for user registration (AUTH_REGISTER_OTP).
   * Call AFTER email send. Fire-and-forget from auth service.
   */
  async sendRegistrationOtp(
    user: { id: string; countryCode: string | null; phone: string | null },
    otp: string,
  ): Promise<WhatsAppOtpResult> {
    return this.dispatchOtp(
      WhatsAppEvent.AUTH_REGISTER_OTP,
      user.id,
      user.countryCode,
      user.phone,
      otp,
    );
  }

  /**
   * Send WhatsApp OTP for passwordless login (AUTH_LOGIN_OTP).
   * Call AFTER storing the hashed OTP. Fire-and-forget from auth service.
   */
  async sendLoginOtp(
    user: { id: string; countryCode: string | null; phone: string | null },
    otp: string,
  ): Promise<WhatsAppOtpResult> {
    return this.dispatchOtp(
      WhatsAppEvent.AUTH_LOGIN_OTP,
      user.id,
      user.countryCode,
      user.phone,
      otp,
    );
  }

  /**
   * Send WhatsApp OTP for password reset (AUTH_PASSWORD_RESET_OTP).
   * Call AFTER email send. Fire-and-forget from auth service.
   */
  async sendPasswordResetOtp(
    user: { id: string; countryCode: string | null; phone: string | null },
    otp: string,
  ): Promise<WhatsAppOtpResult> {
    return this.dispatchOtp(
      WhatsAppEvent.AUTH_PASSWORD_RESET_OTP,
      user.id,
      user.countryCode,
      user.phone,
      otp,
    );
  }
}
