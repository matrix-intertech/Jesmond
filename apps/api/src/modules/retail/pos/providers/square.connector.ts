import { BasePosConnector } from './base.connector';
import { PosConnectorCapabilities, PaymentIntent, PaymentResult } from '../pos-connector.interface';
import { NotImplementedException } from '@nestjs/common';

import * as crypto from 'crypto';

export class SquareConnector extends BasePosConnector {
  getCapabilities(): PosConnectorCapabilities {
    return {
      terminalManagement: true,
      paymentInitiation: true,
      refunds: true,
      webhookEvents: true,
      terminalStatus: true,
      receipts: false, // Managed by Square Terminal
      offlineMode: true, // Square has limited offline mode
    };
  }

  verifyWebhookSignature(request: { headers: any; body: any; rawBody?: Buffer }, secret: string): boolean {
    throw new NotImplementedException('Payment provider not configured/implemented in this environment.');
  }

  parseWebhookEvent(payload: any): { eventId: string; type: string; data: any } {
    return {
      eventId: payload.event_id || '',
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
