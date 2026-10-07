import { Injectable, Logger } from '@nestjs/common';
import { PaymentGateway, CreatePaymentIntentParams } from './payment-gateway.interface';
import Stripe from 'stripe';

@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  private stripe: Stripe | null = null;
  private logger = new Logger(StripePaymentGateway.name);

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2024-06-20' as any,
      });
      this.logger.log('Stripe initialized.');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not found. Stripe is NOT_CONFIGURED.');
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  async createPaymentIntent(params: CreatePaymentIntentParams, idempotencyKey?: string) {
    if (!this.stripe) {
      throw new Error('Stripe is not configured.');
    }

    const options: Stripe.RequestOptions = {};
    if (idempotencyKey) {
      options.idempotencyKey = idempotencyKey;
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      metadata: params.metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    }, options);

    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
    };
  }
}
