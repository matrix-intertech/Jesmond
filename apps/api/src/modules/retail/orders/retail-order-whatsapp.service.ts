import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { WhatsAppTemplateService } from '../../whatsapp/services/whatsapp-template.service';
import { Msg91Provider } from '../../whatsapp/providers/msg91.provider';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../../whatsapp/constants/whatsapp.constants';
import { PrismaService } from '../../prisma/prisma.service';

export interface RetailOrderNotificationPayload {
  orderId: string;
  orderNumber: string;
  organizationId: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  branchName?: string | null;
}

export interface RetailOrderNotificationResult {
  sent: boolean;
  event: WhatsAppEvent;
  reason?: string;
}

/**
 * Service orchestrating WhatsApp notifications for Retail SalesOrders.
 *
 * Events supported:
 * 1. ORDER_CONFIRMED (when order is placed/confirmed/accepted)
 * 2. ORDER_PACKED (when order status transitions to PACKED)
 * 3. ORDER_DELIVERED (when order status transitions to DELIVERED)
 * 4. ORDER_TAKEN_AWAY (when order status transitions to TAKEN)
 *
 * Reliability & Security:
 * - Never blocks order transactions (invoked asynchronously / fire-and-forget).
 * - Enforces idempotency via `${event}_${orderId}` key.
 * - Resolves customer phone from RetailCustomer or associated User.
 * - Normalizes Australian recipient numbers into standard international format.
 * - Checks template approval status before attempting dispatch.
 * - Only includes approved template variables (order_number, customer_name).
 */
@Injectable()
export class RetailOrderWhatsAppService {
  private readonly logger = new Logger(RetailOrderWhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
    private readonly templateService: WhatsAppTemplateService,
    private readonly msg91Provider: Msg91Provider,
  ) {}

  /**
   * Resolves recipient information:
   * - Finds recipient phone from customer object or associated user
   * - Normalizes to MSG91 valid E.164 Australian mobile format
   * - Returns userId (if linked) for user consent checking
   */
  private async resolveRecipient(order: {
    customerId?: string | null;
    customerPhone?: string | null;
    customerName?: string | null;
  }): Promise<{
    phone: string | null;
    customerName: string;
    userId?: string;
  }> {
    let rawPhone = order.customerPhone || null;
    let customerName = (order.customerName || '').trim() || 'Valued Customer';
    let userId: string | undefined = undefined;

    if (order.customerId) {
      const customer = await this.prisma.retailCustomer.findUnique({
        where: { id: order.customerId },
      });

      if (customer) {
        if (!rawPhone && customer.phone) {
          rawPhone = customer.phone;
        }
        if (!order.customerName) {
          customerName =
            `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
            'Valued Customer';
        }

        // If customer has an email, find if there is a matching system user for consent
        if (customer.email) {
          const matchedUser = await this.prisma.user.findUnique({
            where: { email: customer.email.toLowerCase() },
            select: { id: true, phone: true, countryCode: true, whatsappNotifications: true },
          });
          if (matchedUser) {
            userId = matchedUser.id;
            if (!rawPhone && matchedUser.phone) {
              const combined = matchedUser.countryCode
                ? `${matchedUser.countryCode}${matchedUser.phone}`
                : matchedUser.phone;
              rawPhone = combined;
            }
          }
        }
      }
    }

    if (!rawPhone) {
      return { phone: null, customerName, userId };
    }

    const { normalized, isValid, reason } =
      this.msg91Provider.normalizePhoneNumber(rawPhone);

    if (!isValid) {
      this.logger.warn(
        `Retail Order WhatsApp: invalid recipient phone "${rawPhone}": ${reason}`,
      );
      return { phone: null, customerName, userId };
    }

    return { phone: normalized, customerName, userId };
  }

  /**
   * Checks if the template for the event is approved in the registry.
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
   * Dispatches WhatsApp order notification asynchronously.
   */
  private async dispatchOrderNotification(
    event: WhatsAppEvent,
    payload: RetailOrderNotificationPayload,
  ): Promise<RetailOrderNotificationResult> {
    const { orderId, orderNumber } = payload;

    // 1. Resolve recipient
    const { phone, customerName, userId } = await this.resolveRecipient(payload);
    if (!phone) {
      this.logger.warn(
        `Retail Order WhatsApp: no valid recipient phone for order ${orderNumber} (${orderId}). Skipping ${event}.`,
      );
      return {
        sent: false,
        event,
        reason: 'Missing or invalid recipient phone number',
      };
    }

    // 2. Check template approval
    if (!this.isTemplateApproved(event)) {
      this.logger.warn(
        `Retail Order WhatsApp: template for ${event} is pending approval. Skipping for order ${orderNumber}.`,
      );
      return {
        sent: false,
        event,
        reason: `Template for ${event} is pending approval`,
      };
    }

    // 3. Prepare approved template variables
    // Required variables per template service:
    // ORDER_CONFIRMED: order_number, customer_name
    // ORDER_PACKED: order_number
    // ORDER_DELIVERED: order_number
    // ORDER_TAKEN_AWAY: order_number
    const variables: Record<string, string | number> = {
      order_number: orderNumber,
    };
    if (event === WhatsAppEvent.ORDER_CONFIRMED) {
      variables.customer_name = customerName;
    }

    // 4. Send asynchronously via queue with idempotency
    const idempotencyKey = `wa_retail_${event}_${orderId}`;

    try {
      await this.whatsAppService.sendNotificationAsync({
        event,
        recipient: phone,
        userId,
        relatedEntityId: orderId,
        variables,
        idempotencyKey,
        metadata: {
          orderId,
          orderNumber,
          organizationId: payload.organizationId,
        },
      });

      return { sent: true, event };
    } catch (err: any) {
      this.logger.warn(
        `Retail Order WhatsApp enqueue failed for ${event} on order ${orderNumber}: ${err.message}`,
      );
      return { sent: false, event, reason: err.message };
    }
  }

  /**
   * Dispatches ORDER_CONFIRMED notification.
   */
  async notifyOrderConfirmed(
    payload: RetailOrderNotificationPayload,
  ): Promise<RetailOrderNotificationResult> {
    return this.dispatchOrderNotification(WhatsAppEvent.ORDER_CONFIRMED, payload);
  }

  /**
   * Dispatches ORDER_PACKED notification.
   */
  async notifyOrderPacked(
    payload: RetailOrderNotificationPayload,
  ): Promise<RetailOrderNotificationResult> {
    return this.dispatchOrderNotification(WhatsAppEvent.ORDER_PACKED, payload);
  }

  /**
   * Dispatches ORDER_DELIVERED notification.
   */
  async notifyOrderDelivered(
    payload: RetailOrderNotificationPayload,
  ): Promise<RetailOrderNotificationResult> {
    return this.dispatchOrderNotification(WhatsAppEvent.ORDER_DELIVERED, payload);
  }

  /**
   * Dispatches ORDER_TAKEN_AWAY notification.
   */
  async notifyOrderTakenAway(
    payload: RetailOrderNotificationPayload,
  ): Promise<RetailOrderNotificationResult> {
    return this.dispatchOrderNotification(WhatsAppEvent.ORDER_TAKEN_AWAY, payload);
  }
}

