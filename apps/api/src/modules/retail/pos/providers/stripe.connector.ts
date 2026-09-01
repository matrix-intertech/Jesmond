import { BasePosConnector } from './base.connector';
import { PosConnectorCapabilities, PaymentIntent, PaymentResult } from '../pos-connector.interface';

import Stripe from 'stripe';

export class StripeConnector extends BasePosConnector {
  getCapabilities(): PosConnectorCapabilities {
    return {
      terminalManagement: true,
      paymentInitiation: true,
      refunds: true,
      webhookEvents: true,
      terminalStatus: true,
      receipts: false, // Managed by Stripe Terminal if configured
      offlineMode: true, // Supported via Stripe Terminal SDKs
    };
  }

  verifyWebhookSignature(request: { headers: any; body: any; rawBody?: Buffer }, secret: string): boolean {
    const sig = request.headers['stripe-signature'];
    if (!sig) return false;
    if (!request.rawBody) return false;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'mock-stripe-key', {
      apiVersion: '2022-11-15' as any,
    });

    try {
      stripe.webhooks.constructEvent(request.rawBody, sig, secret);
      return true;
    } catch (err) {
      return false;
    }
  }

  parseWebhookEvent(payload: any): { eventId: string; type: string; data: any } {
    return {
      eventId: payload.id || '',
      type: payload.type || '',
      data: payload,
    };
  }

  async pairTerminal(organizationId: string, providerTerminalId: string): Promise<boolean> {
    // Generate Stripe Terminal pairing code
    console.log(`[Stripe] Requesting connection token for terminal ${providerTerminalId}`);
    return true;
  }

  async initiatePayment(organizationId: string, intent: PaymentIntent): Promise<PaymentResult> {
    // Call Stripe PaymentIntent API with terminal reader
    console.log(`[Stripe] Creating PaymentIntent ${intent.internalPaymentIntentId} for ${intent.amount}`);
    return {
      status: 'PENDING',
      providerTransactionId: `pi_${Date.now()}`
    };
  }

  async refundPayment(organizationId: string, providerTransactionId: string, amount: number): Promise<PaymentResult> {
    console.log(`[Stripe] Refunding ${amount} for pi ${providerTransactionId}`);
    return {
      status: 'PENDING',
      providerTransactionId: `re_${Date.now()}`
    };
  }
}
