import { Injectable, BadRequestException } from '@nestjs/common';
import { EmailEvent } from '../constants/email.constants';
import { RenderedEmail } from '../interfaces/email.interface';

export interface TemplateDefinition {
  subject: (vars: Record<string, string>) => string;
  requiredVariables: string[];
  renderText: (vars: Record<string, string>) => string;
  renderHtmlBody: (vars: Record<string, string>, appUrl: string) => string;
}

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wraps inner email HTML content in the master responsive Jesmond email layout.
 */
function wrapHtmlLayout(title: string, innerHtml: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 24px 32px; border-bottom: 2px solid #4f46e5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 700; color: #4f46e5; letter-spacing: -0.5px;">Jesmond</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; font-size: 15px; line-height: 24px; color: #334155;">
              ${innerHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; line-height: 18px; color: #94a3b8; text-align: center;">
              <p style="margin: 0 0 6px 0;">This is an automated transactional notification from Jesmond.</p>
              <p style="margin: 0;">Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

@Injectable()
export class EmailTemplateService {
  private readonly appUrl = process.env.APP_URL || 'https://jesmond.local';

  private readonly templates: Record<EmailEvent, TemplateDefinition> = {
    // 1. AUTH_REGISTER_OTP
    [EmailEvent.AUTH_REGISTER_OTP]: {
      subject: () => 'Verify your Jesmond account',
      requiredVariables: ['otp'],
      renderText: (vars) =>
        `Hello,\n\nUse this code to verify your Jesmond account:\n\n${vars.otp}\n\nThis code expires in 10 minutes. Do not share it with anyone. If you did not start this registration, you can ignore this email.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Verify your Jesmond account</h2>
        <p style="margin: 0 0 16px 0;">Hello,</p>
        <p style="margin: 0 0 20px 0;">Use this code to verify your Jesmond account:</p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; font-family: monospace;">${escapeHtml(vars.otp)}</span>
        </div>
        <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">This code expires in 10 minutes. Do not share it with anyone. If you did not start this registration, you can ignore this email.</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 2. AUTH_LOGIN_OTP
    [EmailEvent.AUTH_LOGIN_OTP]: {
      subject: () => 'Your Jesmond login code',
      requiredVariables: ['otp'],
      renderText: (vars) =>
        `Hello,\n\nYour Jesmond login verification code is:\n\n${vars.otp}\n\nThis code expires in 10 minutes. Do not share it with anyone. If you did not request this code, you can ignore this email.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Your Jesmond login code</h2>
        <p style="margin: 0 0 16px 0;">Hello,</p>
        <p style="margin: 0 0 20px 0;">Your Jesmond login verification code is:</p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; font-family: monospace;">${escapeHtml(vars.otp)}</span>
        </div>
        <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">This code expires in 10 minutes. Do not share it with anyone. If you did not request this code, you can ignore this email.</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 3. AUTH_PASSWORD_RESET_OTP
    [EmailEvent.AUTH_PASSWORD_RESET_OTP]: {
      subject: () => 'Reset your Jesmond password',
      requiredVariables: ['otp'],
      renderText: (vars) =>
        `Hello,\n\nUse this code to continue resetting your Jesmond password:\n\n${vars.otp}\n\nThis code expires in 15 minutes. Do not share it with anyone. If you did not request a reset, ignore this email.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Reset your Jesmond password</h2>
        <p style="margin: 0 0 16px 0;">Hello,</p>
        <p style="margin: 0 0 20px 0;">Use this code to continue resetting your Jesmond password:</p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; font-family: monospace;">${escapeHtml(vars.otp)}</span>
        </div>
        <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">This code expires in 15 minutes. Do not share it with anyone. If you did not request a reset, ignore this email.</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 4. ORDER_CONFIRMED
    [EmailEvent.ORDER_CONFIRMED]: {
      subject: (vars) => `Your Jesmond order ${vars.order_number} is confirmed`,
      requiredVariables: ['order_number', 'customer_name'],
      renderText: (vars) =>
        `Hi ${vars.customer_name},\n\nYour order ${vars.order_number} has been confirmed. We will send another update when its status changes.\n\nThank you for ordering with Jesmond!\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Order Confirmed</h2>
        <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(vars.customer_name)},</p>
        <p style="margin: 0 0 16px 0;">Your order <strong>${escapeHtml(vars.order_number)}</strong> has been confirmed. We will send another update when its status changes.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <span style="font-weight: 600; color: #0f172a;">Order Number:</span> ${escapeHtml(vars.order_number)}<br>
          <span style="font-weight: 600; color: #0f172a;">Status:</span> Confirmed
        </div>
        <p style="margin: 0 0 16px 0;">Thank you for ordering with Jesmond!</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 5. ORDER_PACKED
    [EmailEvent.ORDER_PACKED]: {
      subject: (vars) => `Your Jesmond order ${vars.order_number} has been packed`,
      requiredVariables: ['order_number'],
      renderText: (vars) =>
        `Hello,\n\nYour order ${vars.order_number} has been packed and is getting ready for the next step.\n\nThank you for ordering with Jesmond!\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Order Packed</h2>
        <p style="margin: 0 0 16px 0;">Hello,</p>
        <p style="margin: 0 0 16px 0;">Your order <strong>${escapeHtml(vars.order_number)}</strong> has been packed and is getting ready for the next step.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <span style="font-weight: 600; color: #0f172a;">Order Number:</span> ${escapeHtml(vars.order_number)}<br>
          <span style="font-weight: 600; color: #0f172a;">Status:</span> Packed
        </div>
        <p style="margin: 0 0 16px 0;">Thank you for ordering with Jesmond!</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 6. ORDER_DELIVERED
    [EmailEvent.ORDER_DELIVERED]: {
      subject: (vars) => `Your Jesmond order ${vars.order_number} has been delivered`,
      requiredVariables: ['order_number'],
      renderText: (vars) =>
        `Hello,\n\nYour order ${vars.order_number} has been marked as delivered.\n\nThank you for ordering with Jesmond!\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Order Delivered</h2>
        <p style="margin: 0 0 16px 0;">Hello,</p>
        <p style="margin: 0 0 16px 0;">Your order <strong>${escapeHtml(vars.order_number)}</strong> has been marked as delivered.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <span style="font-weight: 600; color: #0f172a;">Order Number:</span> ${escapeHtml(vars.order_number)}<br>
          <span style="font-weight: 600; color: #10b981;">Status:</span> Delivered
        </div>
        <p style="margin: 0 0 16px 0;">Thank you for ordering with Jesmond!</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 7. ORDER_TAKEN_AWAY
    [EmailEvent.ORDER_TAKEN_AWAY]: {
      subject: (vars) => `Your Jesmond order ${vars.order_number} has been picked up`,
      requiredVariables: ['order_number'],
      renderText: (vars) =>
        `Hello,\n\nYour order ${vars.order_number} has been marked as picked up.\n\nThank you for ordering with Jesmond!\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Order Picked Up</h2>
        <p style="margin: 0 0 16px 0;">Hello,</p>
        <p style="margin: 0 0 16px 0;">Your order <strong>${escapeHtml(vars.order_number)}</strong> has been marked as picked up.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <span style="font-weight: 600; color: #0f172a;">Order Number:</span> ${escapeHtml(vars.order_number)}<br>
          <span style="font-weight: 600; color: #10b981;">Status:</span> Picked Up / Taken Away
        </div>
        <p style="margin: 0 0 16px 0;">Thank you for ordering with Jesmond!</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 8. PROPERTY_LISTING_CONFIRMED
    [EmailEvent.PROPERTY_LISTING_CONFIRMED]: {
      subject: () => 'Your property listing is now published on Jesmond',
      requiredVariables: ['property_title'],
      renderText: (vars) =>
        `Hello,\n\nYour property listing “${vars.property_title}” has been approved and is now published on Jesmond.\n\nSign in to Jesmond to review your listing.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars, appUrl) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Listing Published</h2>
        <p style="margin: 0 0 16px 0;">Hello,</p>
        <p style="margin: 0 0 16px 0;">Your property listing <strong>&ldquo;${escapeHtml(vars.property_title)}&rdquo;</strong> has been approved and is now published on Jesmond.</p>
        <div style="margin: 24px 0;">
          <a href="${escapeHtml(appUrl)}/properties" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">Sign in to review your listing</a>
        </div>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 9. PROPERTY_QUERY_RECEIVED
    [EmailEvent.PROPERTY_QUERY_RECEIVED]: {
      subject: (vars) => `New enquiry for ${vars.property_title}`,
      requiredVariables: ['property_title', 'sender_name'],
      renderText: (vars) =>
        `Hello,\n\nYou have received a new enquiry about “${vars.property_title}” from ${vars.sender_name}.\n\nSign in to Jesmond to review the enquiry and respond.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars, appUrl) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">New Property Enquiry</h2>
        <p style="margin: 0 0 16px 0;">Hello,</p>
        <p style="margin: 0 0 16px 0;">You have received a new enquiry about <strong>&ldquo;${escapeHtml(vars.property_title)}&rdquo;</strong> from <strong>${escapeHtml(vars.sender_name)}</strong>.</p>
        <div style="margin: 24px 0;">
          <a href="${escapeHtml(appUrl)}/messages" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">Sign in to review and respond</a>
        </div>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 10. PROPERTY_MESSAGE_RECEIVED
    [EmailEvent.PROPERTY_MESSAGE_RECEIVED]: {
      subject: (vars) => `You have a new message about ${vars.property_title}`,
      requiredVariables: ['property_title', 'sender_name'],
      renderText: (vars) =>
        `Hello,\n\n${vars.sender_name} sent you a new message about “${vars.property_title}” on Jesmond.\n\nSign in to your Jesmond account to view the message and reply.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars, appUrl) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">New Message Received</h2>
        <p style="margin: 0 0 16px 0;">Hello,</p>
        <p style="margin: 0 0 16px 0;"><strong>${escapeHtml(vars.sender_name)}</strong> sent you a new message about <strong>&ldquo;${escapeHtml(vars.property_title)}&rdquo;</strong> on Jesmond.</p>
        <div style="margin: 24px 0;">
          <a href="${escapeHtml(appUrl)}/messages" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">Sign in to view and reply</a>
        </div>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 11. APPOINTMENT_REQUEST_RECEIVED
    [EmailEvent.APPOINTMENT_REQUEST_RECEIVED]: {
      subject: () => 'We received your appointment request',
      requiredVariables: ['customer_name', 'service_name', 'appointment_time'],
      renderText: (vars) =>
        `Hi ${vars.customer_name},\n\nWe received your request for ${vars.service_name} on ${vars.appointment_time}. Your appointment is awaiting business approval. We will notify you once it is confirmed.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Appointment Request Received</h2>
        <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(vars.customer_name)},</p>
        <p style="margin: 0 0 16px 0;">We received your request for <strong>${escapeHtml(vars.service_name)}</strong> on <strong>${escapeHtml(vars.appointment_time)}</strong>.</p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0; color: #92400e;">
          <strong>Status:</strong> Awaiting business approval. We will notify you once it is confirmed.
        </div>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 12. APPOINTMENT_CONFIRMED
    [EmailEvent.APPOINTMENT_CONFIRMED]: {
      subject: () => 'Your appointment is confirmed',
      requiredVariables: ['customer_name', 'service_name', 'appointment_time'],
      renderText: (vars) =>
        `Hi ${vars.customer_name},\n\nYour appointment for ${vars.service_name} on ${vars.appointment_time} has been confirmed.\n\nWe look forward to seeing you.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Appointment Confirmed</h2>
        <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(vars.customer_name)},</p>
        <p style="margin: 0 0 16px 0;">Your appointment for <strong>${escapeHtml(vars.service_name)}</strong> on <strong>${escapeHtml(vars.appointment_time)}</strong> has been confirmed.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <span style="font-weight: 600; color: #0f172a;">Service:</span> ${escapeHtml(vars.service_name)}<br>
          <span style="font-weight: 600; color: #0f172a;">Time:</span> ${escapeHtml(vars.appointment_time)}<br>
          <span style="font-weight: 600; color: #10b981;">Status:</span> Confirmed
        </div>
        <p style="margin: 0 0 16px 0;">We look forward to seeing you.</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 13. APPOINTMENT_REMINDER
    [EmailEvent.APPOINTMENT_REMINDER]: {
      subject: () => 'Reminder: your upcoming Jesmond appointment',
      requiredVariables: ['customer_name', 'service_name', 'appointment_time'],
      renderText: (vars) =>
        `Hi ${vars.customer_name},\n\nThis is a reminder of your ${vars.service_name} appointment on ${vars.appointment_time}.\n\nWe look forward to seeing you.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Appointment Reminder</h2>
        <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(vars.customer_name)},</p>
        <p style="margin: 0 0 16px 0;">This is a reminder of your <strong>${escapeHtml(vars.service_name)}</strong> appointment on <strong>${escapeHtml(vars.appointment_time)}</strong>.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <span style="font-weight: 600; color: #0f172a;">Service:</span> ${escapeHtml(vars.service_name)}<br>
          <span style="font-weight: 600; color: #0f172a;">Time:</span> ${escapeHtml(vars.appointment_time)}
        </div>
        <p style="margin: 0 0 16px 0;">We look forward to seeing you.</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 14. APPOINTMENT_CANCELLED
    [EmailEvent.APPOINTMENT_CANCELLED]: {
      subject: () => 'Your appointment has been cancelled',
      requiredVariables: ['customer_name', 'service_name', 'reason'],
      renderText: (vars) =>
        `Hi ${vars.customer_name},\n\nYour appointment for ${vars.service_name} has been cancelled.\n\nReason: ${vars.reason || 'Cancelled by request'}\n\nPlease contact the business if you need assistance.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Appointment Cancelled</h2>
        <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(vars.customer_name)},</p>
        <p style="margin: 0 0 16px 0;">Your appointment for <strong>${escapeHtml(vars.service_name)}</strong> has been cancelled.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0; color: #991b1b;">
          <strong>Reason:</strong> ${escapeHtml(vars.reason || 'Cancelled by request')}
        </div>
        <p style="margin: 0 0 16px 0;">Please contact the business if you need assistance.</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 15. APPOINTMENT_RESCHEDULED
    [EmailEvent.APPOINTMENT_RESCHEDULED]: {
      subject: () => 'Your appointment has been rescheduled',
      requiredVariables: ['customer_name', 'service_name', 'old_time', 'new_time'],
      renderText: (vars) =>
        `Hi ${vars.customer_name},\n\nYour ${vars.service_name} appointment has been rescheduled.\n\nPrevious time: ${vars.old_time}\nNew time: ${vars.new_time}\n\nPlease contact the business if the new time does not work for you.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Appointment Rescheduled</h2>
        <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(vars.customer_name)},</p>
        <p style="margin: 0 0 16px 0;">Your <strong>${escapeHtml(vars.service_name)}</strong> appointment has been rescheduled.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <span style="font-weight: 600; color: #64748b; text-decoration: line-through;">Previous time:</span> <span style="text-decoration: line-through; color: #64748b;">${escapeHtml(vars.old_time)}</span><br>
          <span style="font-weight: 600; color: #0f172a;">New time:</span> <strong>${escapeHtml(vars.new_time)}</strong>
        </div>
        <p style="margin: 0 0 16px 0;">Please contact the business if the new time does not work for you.</p>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 16. SERVICE_PROVIDER_NEW_APPOINTMENT
    [EmailEvent.SERVICE_PROVIDER_NEW_APPOINTMENT]: {
      subject: () => 'New appointment request received',
      requiredVariables: ['provider_name', 'service_name', 'appointment_time'],
      renderText: (vars) =>
        `Hi ${vars.provider_name},\n\nA new appointment request for ${vars.service_name} has been submitted for ${vars.appointment_time}. It is awaiting business approval.\n\nSign in to Jesmond to review it.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars, appUrl) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">New Appointment Request</h2>
        <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(vars.provider_name)},</p>
        <p style="margin: 0 0 16px 0;">A new appointment request for <strong>${escapeHtml(vars.service_name)}</strong> has been submitted for <strong>${escapeHtml(vars.appointment_time)}</strong>. It is awaiting business approval.</p>
        <div style="margin: 24px 0;">
          <a href="${escapeHtml(appUrl)}/dashboard/appointments" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">Sign in to review request</a>
        </div>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 17. SERVICE_PROVIDER_APPOINTMENT_CONFIRMED
    [EmailEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED]: {
      subject: () => 'Appointment assigned to you',
      requiredVariables: ['provider_name', 'service_name', 'appointment_time'],
      renderText: (vars) =>
        `Hi ${vars.provider_name},\n\nThe appointment for ${vars.service_name} on ${vars.appointment_time} has been confirmed and assigned to you.\n\nSign in to Jesmond to view the details.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars, appUrl) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Appointment Assigned</h2>
        <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(vars.provider_name)},</p>
        <p style="margin: 0 0 16px 0;">The appointment for <strong>${escapeHtml(vars.service_name)}</strong> on <strong>${escapeHtml(vars.appointment_time)}</strong> has been confirmed and assigned to you.</p>
        <div style="margin: 24px 0;">
          <a href="${escapeHtml(appUrl)}/dashboard/appointments" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">Sign in to view details</a>
        </div>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 18. SERVICE_PROVIDER_APPOINTMENT_REMINDER
    [EmailEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER]: {
      subject: () => 'Reminder: upcoming assigned appointment',
      requiredVariables: ['provider_name', 'service_name', 'appointment_time'],
      renderText: (vars) =>
        `Hi ${vars.provider_name},\n\nThis is a reminder that your ${vars.service_name} appointment is scheduled for ${vars.appointment_time}.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Appointment Reminder</h2>
        <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(vars.provider_name)},</p>
        <p style="margin: 0 0 16px 0;">This is a reminder that your <strong>${escapeHtml(vars.service_name)}</strong> appointment is scheduled for <strong>${escapeHtml(vars.appointment_time)}</strong>.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <span style="font-weight: 600; color: #0f172a;">Service:</span> ${escapeHtml(vars.service_name)}<br>
          <span style="font-weight: 600; color: #0f172a;">Time:</span> ${escapeHtml(vars.appointment_time)}
        </div>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },

    // 19. SERVICE_PROVIDER_APPOINTMENT_CANCELLED
    [EmailEvent.SERVICE_PROVIDER_APPOINTMENT_CANCELLED]: {
      subject: () => 'An assigned appointment has been cancelled',
      requiredVariables: ['provider_name', 'service_name', 'appointment_time'],
      renderText: (vars) =>
        `Hi ${vars.provider_name},\n\nThe appointment for ${vars.service_name} scheduled at ${vars.appointment_time} has been cancelled.\n\nRegards,\nJesmond Team`,
      renderHtmlBody: (vars) => `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Appointment Cancelled</h2>
        <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(vars.provider_name)},</p>
        <p style="margin: 0 0 16px 0;">The appointment for <strong>${escapeHtml(vars.service_name)}</strong> scheduled at <strong>${escapeHtml(vars.appointment_time)}</strong> has been cancelled.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0; color: #991b1b;">
          <strong>Status:</strong> Cancelled
        </div>
        <p style="margin: 24px 0 0 0;">Regards,<br><strong>Jesmond Team</strong></p>
      `,
    },
  };

  /**
   * Retrieves the template definition for an event.
   */
  getTemplate(event: EmailEvent): TemplateDefinition {
    const template = this.templates[event];
    if (!template) {
      throw new BadRequestException(`No email template registered for event "${event}".`);
    }
    return template;
  }

  /**
   * Validates required variables and renders subject, HTML and plain-text fallback.
   */
  render(event: EmailEvent, rawVariables: Record<string, any>): RenderedEmail {
    const template = this.getTemplate(event);

    // Convert variables to strings and ensure required variables are present
    const stringVars: Record<string, string> = {};
    for (const req of template.requiredVariables) {
      const val = rawVariables[req];
      if (val === undefined || val === null || val === '') {
        throw new BadRequestException(
          `Missing required variable "${req}" for email event "${event}".`,
        );
      }
      stringVars[req] = String(val);
    }

    // Also copy any other provided variables
    for (const [k, v] of Object.entries(rawVariables)) {
      if (!(k in stringVars) && v !== undefined && v !== null) {
        stringVars[k] = String(v);
      }
    }

    const subject = template.subject(stringVars);
    const text = template.renderText(stringVars);
    const innerHtml = template.renderHtmlBody(stringVars, this.appUrl);
    const html = wrapHtmlLayout(subject, innerHtml, this.appUrl);

    return { subject, html, text };
  }
}

