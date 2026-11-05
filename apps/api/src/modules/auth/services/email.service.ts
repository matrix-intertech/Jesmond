import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailNotificationStatus } from '@prisma/client';

export interface AccountCreatedNotificationPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  countryCode?: string | null;
  role?: string | null;
  timezone?: string | null;
  createdAt?: Date | string | null;
  location?: string | null;
}

@Injectable()
export class EmailService {
  public static readonly DEFAULT_NOTIFICATION_RECIPIENTS = [
    'jb.narang@matrixonline.in',
    'it.team@matrixonline.in',
  ];

  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail =
    process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@jesmond.local';
  private readonly notifiedUserIds = new Set<string>();

  constructor(
    @Optional() @Inject(RedisService) private readonly redisService?: RedisService,
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
  ) {
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
      const port = parseInt(process.env.SMTP_PORT, 10);
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: port === 465, // true for 465, false for other ports (587 STARTTLS)
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASSWORD
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              }
            : undefined,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });

      // Microsoft 365 sender address verification check
      if (
        process.env.SMTP_USER &&
        process.env.EMAIL_FROM &&
        process.env.EMAIL_FROM.toLowerCase() !==
          process.env.SMTP_USER.toLowerCase()
      ) {
        this.logger.log(
          'Configured EMAIL_FROM differs from SMTP_USER. For Microsoft 365 SMTP, ensure the sender address is authorized on the mailbox.',
        );
      }
    } else {
      this.logger.warn(
        'SMTP_HOST or SMTP_PORT is not set. Emails will only be logged.',
      );
    }
  }

  /**
   * Records OTP emails to central EmailNotificationLog for auditability.
   * Guaranteed: Plaintext OTP is never logged.
   */
  private async logOtpEmail(params: {
    event: string;
    recipient: string;
    subject: string;
    success: boolean;
    error?: string;
  }) {
    if (!this.prisma?.emailNotificationLog) return;
    try {
      await this.prisma.emailNotificationLog.create({
        data: {
          eventType: params.event,
          recipient: params.recipient.toLowerCase().trim(),
          subject: params.subject,
          status: params.success
            ? EmailNotificationStatus.SENT
            : EmailNotificationStatus.FAILED,
          failureReason: params.error ? params.error.slice(0, 1000) : null,
          metadata: {
            authChannel: 'email',
            devMode: !this.transporter,
          },
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create auth OTP email log: ${err.message}`);
    }
  }

  /**
   * Allows setting a mocked transporter in test environments
   */
  setTransporter(transporter: nodemailer.Transporter | null) {
    this.transporter = transporter;
  }

  /**
   * Safely verifies Microsoft SMTP connectivity without sending an email
   */
  async verifySmtpConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        'SMTP transporter is not initialized. Cannot verify SMTP connection.',
      );
      return false;
    }
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully.');
      return true;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMTP connection verification failed: ${errMsg}`);
      return false;
    }
  }

  /**
   * Resolves notification recipients (default or configured via env)
   */
  getAccountCreationRecipients(): string[] {
    const envRecipients = process.env.ACCOUNT_CREATION_NOTIFICATION_RECIPIENTS;
    if (envRecipients) {
      const parsed = envRecipients
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.length > 0);
      if (parsed.length > 0) return parsed;
    }
    return [...EmailService.DEFAULT_NOTIFICATION_RECIPIENTS];
  }

  async sendVerificationOtp(email: string, otp: string): Promise<boolean> {
    const text = `Hello,\n\nUse this code to verify your Jesmond account:\n\n${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone. If you did not start this registration, you can ignore this email.\n\nRegards,\nJesmond Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4f46e5; margin-bottom: 24px;">Jesmond</h1>
        <h2 style="color: #111827;">Verify your Jesmond account</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">Hello,</p>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Use this code to verify your Jesmond account:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 32px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; font-family: monospace;">${escapeHtml(otp)}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
          This code expires in 10 minutes. Do not share it with anyone. If you did not start this registration, you can ignore this email.
        </p>
        <p style="margin-top: 24px; color: #374151;">Regards,<br><strong>Jesmond Team</strong></p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[DEV MODE] Mock Email sent to ${email}. OTP is generated but hidden from logs in production.`,
      );
      this.logger.debug(`[DEV MODE] OTP: ${otp}`);
      this.logOtpEmail({
        event: 'AUTH_REGISTER_OTP',
        recipient: email,
        subject: 'Verify your Jesmond account',
        success: true,
      });
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"Jesmond" <${this.fromEmail}>`,
        to: email,
        subject: 'Verify your Jesmond account',
        text,
        html,
      });
      this.logOtpEmail({
        event: 'AUTH_REGISTER_OTP',
        recipient: email,
        subject: 'Verify your Jesmond account',
        success: true,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
      this.logOtpEmail({
        event: 'AUTH_REGISTER_OTP',
        recipient: email,
        subject: 'Verify your Jesmond account',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async sendLoginOtp(email: string, otp: string): Promise<boolean> {
    const text = `Hello,\n\nYour Jesmond login verification code is:\n\n${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone. If you did not request this code, you can ignore this email.\n\nRegards,\nJesmond Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4f46e5; margin-bottom: 24px;">Jesmond</h1>
        <h2 style="color: #111827;">Your Jesmond login code</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">Hello,</p>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Your Jesmond login verification code is:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 32px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; font-family: monospace;">${escapeHtml(otp)}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
          This code expires in 10 minutes. Do not share it with anyone. If you did not request this code, you can ignore this email.
        </p>
        <p style="margin-top: 24px; color: #374151;">Regards,<br><strong>Jesmond Team</strong></p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[DEV MODE] Mock Login OTP Email sent to ${email}. OTP is generated but hidden from logs in production.`,
      );
      this.logger.debug(`[DEV MODE] Login OTP: ${otp}`);
      this.logOtpEmail({
        event: 'AUTH_LOGIN_OTP',
        recipient: email,
        subject: 'Your Jesmond login code',
        success: true,
      });
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"Jesmond" <${this.fromEmail}>`,
        to: email,
        subject: 'Your Jesmond login code',
        text,
        html,
      });
      this.logOtpEmail({
        event: 'AUTH_LOGIN_OTP',
        recipient: email,
        subject: 'Your Jesmond login code',
        success: true,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send login OTP email to ${email}`, error);
      this.logOtpEmail({
        event: 'AUTH_LOGIN_OTP',
        recipient: email,
        subject: 'Your Jesmond login code',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async sendApplicationApprovalEmail(options: {
    studentEmail: string;
    studentName: string;
    propertyName: string;
    propertyAddress: string;
    providerName: string;
    contactPersonName?: string;
    contactPhone?: string;
    contactEmail?: string;
  }): Promise<boolean> {
    const contactLines: string[] = [];
    if (options.contactPersonName) {
      contactLines.push(
        `<p style="margin: 4px 0; color: #374151;"><strong>Contact Person:</strong> ${options.contactPersonName}</p>`,
      );
    }
    if (options.contactPhone) {
      contactLines.push(
        `<p style="margin: 4px 0; color: #374151;"><strong>Phone:</strong> ${options.contactPhone}</p>`,
      );
    }
    if (options.contactEmail) {
      contactLines.push(
        `<p style="margin: 4px 0; color: #374151;"><strong>Email:</strong> ${options.contactEmail}</p>`,
      );
    }

    const contactBlock =
      contactLines.length > 0
        ? `<div style="margin-top: 16px;">${contactLines.join('')}</div>`
        : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4f46e5; margin-bottom: 24px;">Jesmond</h1>
        <h2 style="color: #111827;">Your accommodation application has been approved! 🎉</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Hi ${options.studentName},
        </p>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Great news! Your accommodation application has been approved.
          Here are the details of your approved accommodation:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 4px 0; color: #374151;"><strong>Property:</strong> ${options.propertyName}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Address:</strong> ${options.propertyAddress}</p>
          <p style="margin: 8px 0 4px 0; color: #374151;"><strong>Provider:</strong> ${options.providerName}</p>
          ${contactBlock}
        </div>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Please reach out to your accommodation provider using the contact details above to coordinate your move-in and next steps.
        </p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
          If you have any questions, please contact us at <a href="mailto:support@jesmond.local" style="color: #4f46e5;">support@jesmond.local</a>.
        </p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[DEV MODE] Mock Approval Email sent to ${options.studentEmail} for property "${options.propertyName}".`,
      );
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"Jesmond" <${this.fromEmail}>`,
        to: options.studentEmail,
        subject: `Your accommodation application has been approved - ${options.propertyName}`,
        html,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send approval email to ${options.studentEmail}`,
        error,
      );
      return false;
    }
  }

  async sendPasswordResetOtp(email: string, otp: string): Promise<boolean> {
    const text = `Hello,\n\nUse this code to continue resetting your Jesmond password:\n\n${otp}\n\nThis code expires in 15 minutes. Do not share it with anyone. If you did not request a reset, ignore this email.\n\nRegards,\nJesmond Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4f46e5; margin-bottom: 24px;">Jesmond</h1>
        <h2 style="color: #111827;">Reset your Jesmond password</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">Hello,</p>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Use this code to continue resetting your Jesmond password:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 32px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; font-family: monospace;">${escapeHtml(otp)}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
          This code expires in 15 minutes. Do not share it with anyone. If you did not request a reset, ignore this email.
        </p>
        <p style="margin-top: 24px; color: #374151;">Regards,<br><strong>Jesmond Team</strong></p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[DEV MODE] Mock Password Reset Email sent to ${email}. OTP is generated but hidden from logs in production.`,
      );
      this.logger.debug(`[DEV MODE] Password Reset OTP: ${otp}`);
      this.logOtpEmail({
        event: 'AUTH_PASSWORD_RESET_OTP',
        recipient: email,
        subject: 'Reset your Jesmond password',
        success: true,
      });
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"Jesmond" <${this.fromEmail}>`,
        to: email,
        subject: 'Reset your Jesmond password',
        text,
        html,
      });
      this.logOtpEmail({
        event: 'AUTH_PASSWORD_RESET_OTP',
        recipient: email,
        subject: 'Reset your Jesmond password',
        success: true,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error,
      );
      this.logOtpEmail({
        event: 'AUTH_PASSWORD_RESET_OTP',
        recipient: email,
        subject: 'Reset your Jesmond password',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async sendApplicationRemovalEmail(options: {
    studentEmail: string;
    studentName: string;
    propertyName: string;
    reason?: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4f46e5; margin-bottom: 24px;">Jesmond</h1>
        <h2 style="color: #111827;">Application Update - ${options.propertyName}</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Hi ${options.studentName},
        </p>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Your application for <strong>${options.propertyName}</strong> has been cancelled/removed by the accommodation provider${options.reason ? ` (${options.reason})` : ''}.
        </p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
          If you have any questions, please contact us at <a href="mailto:support@jesmond.local" style="color: #4f46e5;">support@jesmond.local</a>.
        </p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[DEV MODE] Mock Application Removal Email sent to ${options.studentEmail} for property "${options.propertyName}".`,
      );
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"Jesmond" <${this.fromEmail}>`,
        to: options.studentEmail,
        subject: `Application update for ${options.propertyName}`,
        html,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send application removal email to ${options.studentEmail}`,
        error,
      );
      return false;
    }
  }

  async sendApplicationWithdrawalEmail(options: {
    providerEmail: string;
    providerName: string;
    studentName: string;
    propertyName: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4f46e5; margin-bottom: 24px;">Jesmond</h1>
        <h2 style="color: #111827;">Application Withdrawn</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Hi ${options.providerName},
        </p>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Applicant <strong>${options.studentName}</strong> has withdrawn their application for <strong>${options.propertyName}</strong>.
        </p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[DEV MODE] Mock Application Withdrawal Email sent to ${options.providerEmail} for property "${options.propertyName}".`,
      );
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"Jesmond" <${this.fromEmail}>`,
        to: options.providerEmail,
        subject: `Application withdrawn by student - ${options.propertyName}`,
        html,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send application withdrawal email to ${options.providerEmail}`,
        error,
      );
      return false;
    }
  }

  async sendAccountCreationNotification(
    payload: AccountCreatedNotificationPayload,
  ): Promise<boolean> {
    if (!payload?.id) {
      return false;
    }

    // Idempotency check 1: In-memory cache (prevents duplicate within same process)
    if (this.notifiedUserIds.has(payload.id)) {
      this.logger.debug(
        `Skipping duplicate account creation notification for user ID ${payload.id} (memory cache)`,
      );
      return true;
    }

    // Idempotency check 2: Atomic Redis SET NX lock (prevents duplicate across distributed instances)
    const redisKey = `notification:account_created:${payload.id}`;
    let acquiredRedisLock = false;
    if (this.redisService) {
      try {
        const client = (this.redisService as any).client;
        if (client && typeof client.set === 'function') {
          // Atomic SET ... EX ... NX returns 'OK' if set, null if key already existed
          const result = await client.set(
            redisKey,
            JSON.stringify({ sentAt: new Date().toISOString() }),
            'EX',
            60 * 60 * 24 * 30,
            'NX',
          );
          if (result !== 'OK') {
            this.notifiedUserIds.add(payload.id);
            this.logger.debug(
              `Skipping duplicate account creation notification for user ID ${payload.id} (redis atomic NX)`,
            );
            return true;
          }
          acquiredRedisLock = true;
        } else {
          // Fallback if raw client is not directly accessible
          const cached = await this.redisService.get(redisKey);
          if (cached) {
            this.notifiedUserIds.add(payload.id);
            this.logger.debug(
              `Skipping duplicate account creation notification for user ID ${payload.id} (redis cache)`,
            );
            return true;
          }
          await this.redisService.set(
            redisKey,
            { sentAt: new Date().toISOString() },
            60 * 60 * 24 * 30,
          );
          acquiredRedisLock = true;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Redis idempotency check warning: ${errMsg}`);
      }
    }

    this.notifiedUserIds.add(payload.id);

    const recipients = this.getAccountCreationRecipients();
    const fullName =
      [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim() ||
      'Not provided';
    const phone = payload.phone
      ? `${payload.countryCode ? payload.countryCode + ' ' : ''}${payload.phone}`
      : 'Not provided';
    const location = payload.location || 'Not provided';
    const formattedTimestamp = formatAccountCreatedAt(
      payload.createdAt,
      payload.timezone,
    );
    const role = payload.role || 'Not provided';

    const text = [
      'New User Account Created - Jesmond',
      '------------------------------------',
      `User ID: ${payload.id}`,
      `Full Name / Username: ${fullName}`,
      `Registered Email: ${payload.email}`,
      `Phone Number: ${phone}`,
      `Location: ${location}`,
      `Account Role: ${role}`,
      `Created At: ${formattedTimestamp}`,
      '------------------------------------',
      'This is an automated notification from Jesmond.',
    ].join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #4f46e5; margin: 0; font-size: 20px;">Jesmond &bull; New User Account Created</h2>
        </div>
        <p style="color: #374151; font-size: 15px; line-height: 22px; margin: 0 0 16px 0;">
          A new user account has been successfully created and persisted in the database.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tbody>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 8px; font-weight: 600; width: 35%; color: #4b5563;">User ID</td>
              <td style="padding: 10px 8px; color: #111827; font-family: monospace;">${escapeHtml(payload.id)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 8px; font-weight: 600; color: #4b5563;">Full Name / Username</td>
              <td style="padding: 10px 8px; color: #111827;">${escapeHtml(fullName)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 8px; font-weight: 600; color: #4b5563;">Registered Email</td>
              <td style="padding: 10px 8px; color: #111827;"><a href="mailto:${escapeHtml(payload.email)}" style="color: #4f46e5; text-decoration: none;">${escapeHtml(payload.email)}</a></td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 8px; font-weight: 600; color: #4b5563;">Phone Number</td>
              <td style="padding: 10px 8px; color: #111827;">${escapeHtml(phone)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 8px; font-weight: 600; color: #4b5563;">Location</td>
              <td style="padding: 10px 8px; color: #111827;">${escapeHtml(location)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 8px; font-weight: 600; color: #4b5563;">Account Role</td>
              <td style="padding: 10px 8px; color: #111827;">${escapeHtml(role)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 8px; font-weight: 600; color: #4b5563;">Account Created At</td>
              <td style="padding: 10px 8px; color: #111827;">${escapeHtml(formattedTimestamp)}</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
          Automated account notification sent to authorized administrators.
        </div>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[DEV MODE] Mock Account Creation Notification sent for user ID ${payload.id} (${payload.email}) to: ${recipients.join(', ')}`,
      );
      if (this.redisService && !acquiredRedisLock) {
        await this.redisService.set(
          redisKey,
          { sentAt: new Date().toISOString() },
          60 * 60 * 24 * 30,
        );
      }
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"Jesmond" <${this.fromEmail}>`,
        to: recipients,
        subject: `New User Account Created: ${fullName} (${payload.email}) - Jesmond`,
        text,
        html,
      });

      this.logger.log(
        `Account creation notification sent successfully for user ID ${payload.id}`,
      );
      if (this.redisService && !acquiredRedisLock) {
        await this.redisService.set(
          redisKey,
          { sentAt: new Date().toISOString() },
          60 * 60 * 24 * 30,
        );
      }
      return true;
    } catch (error: unknown) {
      // Revert in-memory and Redis lock on failure so delivery can be retried safely
      this.notifiedUserIds.delete(payload.id);
      if (this.redisService) {
        await this.redisService.del(redisKey).catch(() => {});
      }
      // Safe logging without exposing secrets, email body, or credentials
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send account creation notification for user ID ${payload.id}: ${errMsg}`,
      );
      return false;
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAccountCreatedAt(
  createdAt?: Date | string | null,
  timezone?: string | null,
): string {
  if (!createdAt) {
    return 'Not provided';
  }
  const date = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (isNaN(date.getTime())) {
    return 'Not provided';
  }
  const tz = timezone || 'Australia/Sydney';
  try {
    const formatted = new Intl.DateTimeFormat('en-AU', {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    }).format(date);
    return `${formatted} (${tz})`;
  } catch {
    return `${date.toISOString()} (${tz})`;
  }
}
