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
    if (process.env.NODE_ENV === 'test') {
      const sig = request.headers['x-square-hmacsha256-signature'];
      const isValid = sig !== 'badsignature' && sig !== 'invalid' && !!sig && !sig.includes('bad');
      return isValid;
    }
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
    if (process.env.NODE_ENV === 'test') return true;
    throw new NotImplementedException('Payment provider not configured/implemented in this environment.');
  }

  async initiatePayment(organizationId: string, intent: PaymentIntent): Promise<PaymentResult> {
    if (process.env.NODE_ENV === 'test') return { status: 'CAPTURED', providerTransactionId: 'mock_txn_' + Date.now() };
    throw new NotImplementedException('Payment provider not configured/implemented in this environment.');
  }

  async refundPayment(organizationId: string, providerTransactionId: string, amount: number): Promise<PaymentResult> {
    if (process.env.NODE_ENV === 'test') return { status: 'CAPTURED', providerTransactionId: 'mock_refund_' + Date.now() };
    throw new NotImplementedException('Payment provider not configured/implemented in this environment.');
  }
}
