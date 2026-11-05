import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { EmailEvent } from '../../email/constants/email.constants';

export interface RetailOrderEmailPayload {
  orderId: string;
  orderNumber: string;
  organizationId: string;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  branchName?: string | null;
}

export interface RetailOrderEmailResult {
  sent: boolean;
  event: EmailEvent;
  reason?: string;
}

@Injectable()
export class RetailOrderEmailService {
  private readonly logger = new Logger(RetailOrderEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Resolves recipient email, customer name, and linked User ID.
   */
  private async resolveRecipient(order: {
    customerId?: string | null;
    customerEmail?: string | null;
    customerName?: string | null;
  }): Promise<{
    email: string | null;
    customerName: string;
    userId?: string;
  }> {
    let email = order.customerEmail || null;
    let customerName = (order.customerName || '').trim() || 'Valued Customer';
    let userId: string | undefined = undefined;

    if (order.customerId) {
      const customer = await this.prisma.retailCustomer.findUnique({
        where: { id: order.customerId },
      });

      if (customer) {
        if (!email && customer.email) {
          email = customer.email;
        }
        if (!order.customerName) {
          customerName =
            `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
            'Valued Customer';
        }
      }
    }

    if (email) {
      email = email.trim().toLowerCase();
      const matchedUser = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, emailNotifications: true },
      });
      if (matchedUser) {
        userId = matchedUser.id;
      }
    }

    return { email, customerName, userId };
  }

  /**
   * Dispatches ORDER_CONFIRMED email notification.
   */
  async notifyOrderConfirmed(
    payload: RetailOrderEmailPayload,
  ): Promise<RetailOrderEmailResult> {
    try {
      const { email, customerName, userId } = await this.resolveRecipient(payload);
      if (!email) {
        return {
          sent: false,
          event: EmailEvent.ORDER_CONFIRMED,
          reason: 'No recipient email found',
        };
      }

      const idempotencyKey = `email_order_confirmed_${payload.orderId}`;
      await this.emailService.sendEmailAsync({
        event: EmailEvent.ORDER_CONFIRMED,
        recipient: email,
        userId,
        relatedEntityId: payload.orderId,
        idempotencyKey,
        variables: {
          order_number: payload.orderNumber,
          customer_name: customerName,
        },
        metadata: {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          organizationId: payload.organizationId,
        },
      });

      return { sent: true, event: EmailEvent.ORDER_CONFIRMED };
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch ORDER_CONFIRMED email: ${err.message}`);
      return {
        sent: false,
        event: EmailEvent.ORDER_CONFIRMED,
        reason: err.message,
      };
    }
  }

  /**
   * Dispatches ORDER_PACKED email notification.
   */
  async notifyOrderPacked(
    payload: RetailOrderEmailPayload,
  ): Promise<RetailOrderEmailResult> {
    try {
      const { email, userId } = await this.resolveRecipient(payload);
      if (!email) {
        return {
          sent: false,
          event: EmailEvent.ORDER_PACKED,
          reason: 'No recipient email found',
        };
      }

      const idempotencyKey = `email_order_packed_${payload.orderId}`;
      await this.emailService.sendEmailAsync({
        event: EmailEvent.ORDER_PACKED,
        recipient: email,
        userId,
        relatedEntityId: payload.orderId,
        idempotencyKey,
        variables: {
          order_number: payload.orderNumber,
        },
        metadata: {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
        },
      });

      return { sent: true, event: EmailEvent.ORDER_PACKED };
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch ORDER_PACKED email: ${err.message}`);
      return {
        sent: false,
        event: EmailEvent.ORDER_PACKED,
        reason: err.message,
      };
    }
  }

  /**
   * Dispatches ORDER_DELIVERED email notification (delivery fulfillment only).
   */
  async notifyOrderDelivered(
    payload: RetailOrderEmailPayload,
  ): Promise<RetailOrderEmailResult> {
    try {
      const { email, userId } = await this.resolveRecipient(payload);
      if (!email) {
        return {
          sent: false,
          event: EmailEvent.ORDER_DELIVERED,
          reason: 'No recipient email found',
        };
      }

      const idempotencyKey = `email_order_delivered_${payload.orderId}`;
      await this.emailService.sendEmailAsync({
        event: EmailEvent.ORDER_DELIVERED,
        recipient: email,
        userId,
        relatedEntityId: payload.orderId,
        idempotencyKey,
        variables: {
          order_number: payload.orderNumber,
        },
        metadata: {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
        },
      });

      return { sent: true, event: EmailEvent.ORDER_DELIVERED };
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch ORDER_DELIVERED email: ${err.message}`);
      return {
        sent: false,
        event: EmailEvent.ORDER_DELIVERED,
        reason: err.message,
      };
    }
  }

  /**
   * Dispatches ORDER_TAKEN_AWAY email notification (takeaway fulfillment only).
   */
  async notifyOrderTakenAway(
    payload: RetailOrderEmailPayload,
  ): Promise<RetailOrderEmailResult> {
    try {
      const { email, userId } = await this.resolveRecipient(payload);
      if (!email) {
        return {
          sent: false,
          event: EmailEvent.ORDER_TAKEN_AWAY,
          reason: 'No recipient email found',
        };
      }

      const idempotencyKey = `email_order_taken_away_${payload.orderId}`;
      await this.emailService.sendEmailAsync({
        event: EmailEvent.ORDER_TAKEN_AWAY,
        recipient: email,
        userId,
        relatedEntityId: payload.orderId,
        idempotencyKey,
        variables: {
          order_number: payload.orderNumber,
        },
        metadata: {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
        },
      });

      return { sent: true, event: EmailEvent.ORDER_TAKEN_AWAY };
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch ORDER_TAKEN_AWAY email: ${err.message}`);
      return {
        sent: false,
        event: EmailEvent.ORDER_TAKEN_AWAY,
        reason: err.message,
      };
    }
  }
}

