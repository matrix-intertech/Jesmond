import { BasePosConnector } from './base.connector';
import { PosConnectorCapabilities, PaymentIntent, PaymentResult } from '../pos-connector.interface';
import { NotImplementedException } from '@nestjs/common';

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
    throw new NotImplementedException('Payment provider not configured/implemented in this environment.');
  }

  parseWebhookEvent(payload: any): { eventId: string; type: string; data: any } {
    return {
      eventId: payload.id || '',
      type: payload.type || '',
      data: payload,
    };
  }

  async pairTerminal(organizationId: string, providerTerminalId: string): Promise<boolean> {
    throw new NotImplementedException('Payment provider not configured/implemented in this environment.');
  }

  async initiatePayment(organizationId: string, intent: PaymentIntent): Promise<PaymentResult> {
    throw new NotImplementedException('Payment provider not configured/implemented in this environment.');
  }

  async refundPayment(organizationId: string, providerTransactionId: string, amount: number): Promise<PaymentResult> {
    throw new NotImplementedException('Payment provider not configured/implemented in this environment.');
  }
}
