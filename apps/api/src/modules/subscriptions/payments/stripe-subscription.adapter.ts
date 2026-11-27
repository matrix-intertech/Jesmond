import {
  BadRequestException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { StripePaymentGateway } from '../../retail/payments/gateways/stripe-payment.gateway';
import {
  CreateSubscriptionCheckoutParams,
  CreateSubscriptionCheckoutResult,
  ParsedStripeWebhookEvent,
  SubscriptionPaymentAdapter,
} from './subscription-payment-adapter.interface';

@Injectable()
export class StripeSubscriptionAdapter implements SubscriptionPaymentAdapter {
  readonly providerName = 'STRIPE';

  constructor(
    @Optional() private readonly stripeGateway?: StripePaymentGateway,
  ) {}

  private getStripeClient(): Stripe | null {
    return this.stripeGateway?.getClient() ?? null;
  }

  private getWebhookSecret(): string | null {
    return (
      process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      null
    );
  }

  isConfigured(): boolean {
    return this.getStripeClient() !== null;
  }

  isWebhookConfigured(): boolean {
    return Boolean(this.getWebhookSecret());
  }

  async createCheckoutSession(
    params: CreateSubscriptionCheckoutParams,
  ): Promise<CreateSubscriptionCheckoutResult> {
    const stripe = this.getStripeClient();
    if (!stripe) {
      throw new ServiceUnavailableException('Stripe API key is not configured');
    }

    const intervalCount = params.interval === 'QUARTERLY' ? 3 : 1;
    const stripeInterval = params.interval === 'ANNUAL' ? 'year' : 'month';

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        ...(params.externalCustomerId
          ? { customer: params.externalCustomerId }
          : params.customerEmail
            ? { customer_email: params.customerEmail }
            : {}),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: params.currency.toLowerCase(),
              unit_amount: params.unitAmountMinor,
              recurring: {
                interval: stripeInterval,
                interval_count: intervalCount,
              },
              product_data: {
                name: params.planName,
                metadata: {
                  planId: params.planId,
                  planCode: params.planCode,
                },
              },
            },
          },
        ],
        metadata: {
          organizationId: params.organizationId,
          planId: params.planId,
          planPriceId: params.planPriceId,
          interval: params.interval,
        },
        subscription_data: {
          metadata: {
            organizationId: params.organizationId,
            planId: params.planId,
            planPriceId: params.planPriceId,
            interval: params.interval,
          },
        },
      },
      { idempotencyKey: params.idempotencyKey },
    );

    if (!session.url) {
      throw new ServiceUnavailableException(
        'Stripe did not return a checkout URL',
      );
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  verifyAndParseWebhook(
    rawBody: Buffer,
    signature: string,
  ): ParsedStripeWebhookEvent {
    const stripe = this.getStripeClient();
    if (!stripe) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const secret = this.getWebhookSecret();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Stripe webhook secret is not configured',
      );
    }

    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err: any) {
      throw new BadRequestException(
        `Invalid Stripe webhook signature: ${err?.message || 'verification failed'}`,
      );
    }

    return {
      id: event.id,
      type: event.type,
      created: event.created,
      dataObject: event.data.object as Record<string, any>,
    };
  }

  async cancelExternalSubscription(
    externalSubscriptionId: string,
    immediate: boolean,
  ): Promise<void> {
    const stripe = this.getStripeClient();
    if (!stripe) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    if (immediate) {
      await stripe.subscriptions.cancel(externalSubscriptionId);
    } else {
      await stripe.subscriptions.update(externalSubscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  async refundPayment(params: {
    externalPaymentId: string;
    amountMinor?: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string; status: string }> {
    const stripe = this.getStripeClient();
    if (!stripe) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const refund = await stripe.refunds.create(
      {
        payment_intent: params.externalPaymentId,
        ...(params.amountMinor !== undefined
          ? { amount: params.amountMinor }
          : {}),
      },
      { idempotencyKey: params.idempotencyKey },
    );

    return {
      refundId: refund.id,
      status: refund.status ?? 'succeeded',
    };
  }
}
