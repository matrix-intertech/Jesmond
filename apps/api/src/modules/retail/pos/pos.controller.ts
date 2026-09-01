import { Controller, Post, Body, Headers, BadRequestException, Injectable, InternalServerErrorException, Param, Req } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PosConnector } from './pos-connector.interface';
import { TyroConnector } from './providers/tyro.connector';
import { SquareConnector } from './providers/square.connector';
import { StripeConnector } from './providers/stripe.connector';
import { ZellerConnector } from './providers/zeller.connector';

@Injectable()
export class PosWebhookService {
  constructor(private prisma: PrismaService) {}

  // A registry for POS connectors
  private getConnector(provider: string): PosConnector | null {
    switch (provider.toUpperCase()) {
      case 'TYRO': return new TyroConnector();
      case 'SQUARE': return new SquareConnector();
      case 'STRIPE': return new StripeConnector();
      case 'ZELLER': return new ZellerConnector();
      default: return null;
    }
  }

  verifySignature(provider: string, req: { headers: any; body: any; rawBody?: Buffer }, signature: string): boolean {
    const connector = this.getConnector(provider);
    if (!connector) {
      throw new BadRequestException(`Provider not configured: ${provider}`);
    }

    let secret = 'dummy-secret';
    if (provider.toUpperCase() === 'STRIPE') {
      secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_stripe_test';
    } else if (provider.toUpperCase() === 'SQUARE') {
      secret = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || 'sq_sig_test';
    } else if (provider.toUpperCase() === 'TYRO') {
      secret = process.env.TYRO_WEBHOOK_SECRET || 'tyro_sig_test';
    }

    const verified = connector.verifyWebhookSignature(req, secret);
    if (!verified) {
      throw new BadRequestException('Invalid webhook signature');
    }
    return true;
  }

  parseEvent(provider: string, payload: any) {
    const connector = this.getConnector(provider);
    if (!connector) {
      throw new BadRequestException(`Provider not configured: ${provider}`);
    }
    return connector.parseWebhookEvent(payload);
  }

  async processWebhook(provider: string, externalEventId: string, eventType: string, payload: any) {
    try {
      const existing = await this.prisma.posWebhookEvent.findUnique({
        where: {
          provider_externalEventId: {
            provider: provider.toUpperCase(),
            externalEventId,
          },
        },
      });

      if (existing) {
        return { status: 'IGNORED', message: 'Duplicate event' };
      }

      // 1. Identify the transactionId from the event payload
      let transactionId = undefined;
      if (payload.data?.object?.payment?.id) {
        transactionId = payload.data.object.payment.id; // Real Square
      } else if (payload.data?.object?.id) {
        transactionId = payload.data.object.id; // Stripe
      } else if (payload.payment?.id) {
        transactionId = payload.payment.id; // Square mock fallback
      } else {
        transactionId = payload.transactionId || payload.id || payload.eventId;
      }

      let payment = null;
      let resolvedOrgId = payload.organizationId;

      if (transactionId) {
        payment = await this.prisma.retailPayment.findFirst({
          where: { transactionId },
          include: { order: true }
        });
        if (payment) {
          resolvedOrgId = payment.order.organizationId;
        }
      }


      // Ensure resolvedOrgId is a valid foreign key reference
      if (!resolvedOrgId || resolvedOrgId === 'UNKNOWN') {
        const defaultOrg = await this.prisma.organization.findFirst();
        resolvedOrgId = defaultOrg ? defaultOrg.id : 'UNKNOWN';
      }

      const webhook = await this.prisma.posWebhookEvent.create({
        data: {
          provider: provider.toUpperCase(),
          externalEventId,
          eventType,
          payload,
          organizationId: resolvedOrgId,
          status: 'PENDING',
        },
      });

      if (transactionId && !payment) {
        await this.prisma.posWebhookEvent.update({
          where: { provider_externalEventId: { provider: provider.toUpperCase(), externalEventId } },
          data: { status: 'FAILED', error: 'Payment not found', processedAt: new Date() },
        });
        return { status: 'FAILED', message: 'Payment not found' };
      }

      let newPaymentStatus: string | null = null;
      let newOrderStatus: string | null = null;

        const isSuccessEvent =
          eventType === 'payment_intent.succeeded' ||
          ((eventType === 'payment.updated' || eventType === 'payment.created') && (
            payload.status === 'COMPLETED' ||
            payload.status === 'APPROVED' ||
            payload.payment?.status === 'COMPLETED' ||
            payload.data?.object?.payment?.status === 'COMPLETED'
          )) ||
          eventType === 'transaction_completed';

        const isFailureEvent =
          eventType === 'payment_intent.payment_failed' ||
          eventType === 'transaction_failed';


        if (isSuccessEvent) {
          newPaymentStatus = 'PAID';
          newOrderStatus = 'COMPLETED';
        } else if (isFailureEvent) {
          newPaymentStatus = 'FAILED';
        }

        if (newPaymentStatus && payment) {
          // Safety: never transition a cancelled order/payment via webhook
          if (payment.order.status === 'CANCELLED') {
            await this.prisma.posWebhookEvent.update({
              where: { provider_externalEventId: { provider: provider.toUpperCase(), externalEventId } },
              data: { status: 'IGNORED', error: 'Order already cancelled', processedAt: new Date() },
            });
            return { status: 'IGNORED', message: 'Order is cancelled, webhook ignored' };
          }

          await this.prisma.$transaction(async (tx) => {
            await tx.retailPayment.update({
              where: { id: payment.id },
              data: { status: newPaymentStatus as any },
            });

            if (newOrderStatus) {
              await tx.salesOrder.update({
                where: { id: payment.orderId },
                data: { status: newOrderStatus as any },
              });
            }
          });
        }

      await this.prisma.posWebhookEvent.update({
        where: { provider_externalEventId: { provider: provider.toUpperCase(), externalEventId } },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });

      // Audit Logging
      await this.prisma.auditLog.create({
        data: {
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: 'webhook.process',
          resourceType: 'PosWebhookEvent',
          resourceId: webhook.id,
          changes: { eventType, provider }
        }
      });

      return { status: 'SUCCESS' };
    } catch (e) {
      console.error('Webhook processing failed:', e);
      throw new InternalServerErrorException('Failed to process webhook');
    }
  }
}

@Controller('retail/pos/webhooks')
export class PosWebhookController {
  constructor(private webhookService: PosWebhookService) {}

  @Post(':provider')
  async handleWebhook(
    @Req() req: any,
    @Headers('x-pos-signature') signature: string,
    @Headers('stripe-signature') stripeSignature: string,
    @Headers('x-square-hmacsha256-signature') squareSignature: string,
    @Headers('x-tyro-signature') tyroSignature: string,
    @Body() payload: any,
    @Param('provider') provider: string,
  ) {
    const sig = stripeSignature || squareSignature || tyroSignature || signature || '';
    if (!sig && provider.toUpperCase() !== 'ZELLER') {
      throw new BadRequestException('Missing signature');
    }

    // Pass the raw request which NestJS populates with rawBody
    this.webhookService.verifySignature(provider, req, sig);

    const parsedEvent = this.webhookService.parseEvent(provider, payload);
    const externalEventId = parsedEvent.eventId;
    const eventType = parsedEvent.type;

    if (!externalEventId || !eventType) {
      throw new BadRequestException('Invalid payload structure');
    }

    return this.webhookService.processWebhook(provider, externalEventId, eventType, parsedEvent.data);
  }
}
