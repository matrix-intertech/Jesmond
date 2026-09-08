import { BasePosConnector } from './base.connector';
import { PosConnectorCapabilities, PaymentIntent, PaymentResult } from '../pos-connector.interface';
import { NotImplementedException } from '@nestjs/common';

export class TyroConnector extends BasePosConnector {
  getCapabilities(): PosConnectorCapabilities {
    return {
      terminalManagement: true,
      paymentInitiation: true,
      refunds: true,
      webhookEvents: true,
      terminalStatus: true,
      receipts: false, // Tyro terminals typically print their own receipts natively
      offlineMode: true, // Tyro supports store-and-forward in some modes
    };
  }

  verifyWebhookSignature(request: { headers: any; body: any; rawBody?: Buffer }, secret: string): boolean {
    throw new NotImplementedException('Payment provider not configured/implemented in this environment.');
  }

  parseWebhookEvent(payload: any): { eventId: string; type: string; data: any } {
    return {
      eventId: payload.id || '',
      type: payload.eventType || '',
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
