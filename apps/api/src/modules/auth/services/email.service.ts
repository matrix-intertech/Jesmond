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
}
