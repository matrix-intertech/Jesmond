import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendMailArgs {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  from?: string;
}

export interface MailDispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class NodemailerProvider {
  private readonly logger = new Logger(NodemailerProvider.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail =
    process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@jesmond.local';

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
      const port = parseInt(process.env.SMTP_PORT, 10);
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: port === 465,
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

      if (
        process.env.SMTP_USER &&
        process.env.EMAIL_FROM &&
        process.env.EMAIL_FROM.toLowerCase() !==
          process.env.SMTP_USER.toLowerCase()
      ) {
        this.logger.log(
          'Configured EMAIL_FROM differs from SMTP_USER. Ensure sender is authorized.',
        );
      }
    } else {
      this.logger.warn(
        'SMTP_HOST or SMTP_PORT is not set. Emails will only be logged in dev mode.',
      );
    }
  }

  /**
   * Set a custom or mocked transporter for unit/integration testing.
   */
  setTransporter(transporter: nodemailer.Transporter | null) {
    this.transporter = transporter;
  }

  getTransporter(): nodemailer.Transporter | null {
    return this.transporter;
  }

  getFromAddress(): string {
    return this.fromEmail;
  }

  /**
   * Safely dispatches an email message without leaking sensitive data to logs.
   */
  async sendMail(args: SendMailArgs): Promise<MailDispatchResult> {
    const from = args.from || `"Jesmond" <${this.fromEmail}>`;

    if (!this.transporter) {
      this.logger.log(
        `[DEV MODE - SMTP Not Configured] Mock email dispatched to ${JSON.stringify(
          args.to,
        )}: "${args.subject}"`,
      );
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: args.to,
        subject: args.subject,
        text: args.text,
        html: args.html,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP email dispatch failure: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}

