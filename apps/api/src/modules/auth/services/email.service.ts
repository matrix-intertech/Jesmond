import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail = process.env.EMAIL_FROM || 'noreply@jesmond.local';

  constructor() {
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
      const port = parseInt(process.env.SMTP_PORT, 10);
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: port === 465, // true for 465, false for other ports
        auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        } : undefined,
      });
    } else {
      this.logger.warn('SMTP_HOST or SMTP_PORT is not set. Emails will only be logged.');
    }
  }

  async sendVerificationOtp(email: string, otp: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4f46e5; margin-bottom: 24px;">Jesmond</h1>
        <h2 style="color: #111827;">Verify your email address</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Thanks for signing up for Jesmond! Please use the following 6-digit code to verify your email address. 
          This code will expire in 10 minutes.
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 32px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
          Security Note: Jesmond team will never ask you for your password or this verification code.
        </p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV MODE] Mock Email sent to ${email}. OTP is generated but hidden from logs in production.`);
      // We log OTP in dev mode only if SMTP is not configured
      this.logger.debug(`[DEV MODE] OTP: ${otp}`);
      return true; // Return true in dev mode
    }

    try {
      await this.transporter.sendMail({
        from: `"Jesmond" <${this.fromEmail}>`,
        to: email,
        subject: 'Verify your email - Jesmond',
        html,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
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
      contactLines.push(`<p style="margin: 4px 0; color: #374151;"><strong>Contact Person:</strong> ${options.contactPersonName}</p>`);
    }
    if (options.contactPhone) {
      contactLines.push(`<p style="margin: 4px 0; color: #374151;"><strong>Phone:</strong> ${options.contactPhone}</p>`);
    }
    if (options.contactEmail) {
      contactLines.push(`<p style="margin: 4px 0; color: #374151;"><strong>Email:</strong> ${options.contactEmail}</p>`);
    }

    const contactBlock = contactLines.length > 0
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
      this.logger.log(`[DEV MODE] Mock Approval Email sent to ${options.studentEmail} for property "${options.propertyName}".`);
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
      this.logger.error(`Failed to send approval email to ${options.studentEmail}`, error);
      return false;
    }
  }

  async sendPasswordResetOtp(email: string, otp: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4f46e5; margin-bottom: 24px;">Jesmond</h1>
        <h2 style="color: #111827;">Reset your password</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          Your Jesmond password reset OTP is:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 32px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">${otp}</span>
        </div>
        <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
          This OTP is valid for 15 minutes.
        </p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
          If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV MODE] Mock Password Reset Email sent to ${email}. OTP is generated but hidden from logs in production.`);
      this.logger.debug(`[DEV MODE] Password Reset OTP: ${otp}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"Jesmond" <${this.fromEmail}>`,
        to: email,
        subject: 'Reset your password - Jesmond',
        html,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, error);
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
      this.logger.log(`[DEV MODE] Mock Application Removal Email sent to ${options.studentEmail} for property "${options.propertyName}".`);
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
      this.logger.error(`Failed to send application removal email to ${options.studentEmail}`, error);
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
      this.logger.log(`[DEV MODE] Mock Application Withdrawal Email sent to ${options.providerEmail} for property "${options.propertyName}".`);
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
      this.logger.error(`Failed to send application withdrawal email to ${options.providerEmail}`, error);
      return false;
    }
  }
}
