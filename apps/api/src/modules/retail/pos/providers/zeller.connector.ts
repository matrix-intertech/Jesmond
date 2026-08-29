import { BasePosConnector } from './base.connector';
import { PosConnectorCapabilities, PaymentIntent, PaymentResult } from '../pos-connector.interface';
import { NotImplementedException } from '@nestjs/common';

export class ZellerConnector extends BasePosConnector {
  getCapabilities(): PosConnectorCapabilities {
    return {
      terminalManagement: false,
      paymentInitiation: false,
      refunds: false,
      webhookEvents: false,
      terminalStatus: false,
      receipts: false,
      offlineMode: false,
    };
  }

  verifyWebhookSignature(request: { headers: any; body: any; rawBody?: Buffer }, secret: string): boolean {
    throw new NotImplementedException('Zeller integration requires official Partner Access. Webhooks not supported.');
  }

  parseWebhookEvent(payload: any): { eventId: string; type: string; data: any } {
    throw new NotImplementedException('Zeller integration requires official Partner Access.');
  }

  async pairTerminal(organizationId: string, providerTerminalId: string): Promise<boolean> {
    throw new NotImplementedException('Zeller pairing requires Partner API access which is currently unavailable.');
  }

  async initiatePayment(organizationId: string, intent: PaymentIntent): Promise<PaymentResult> {
    throw new NotImplementedException('Zeller payment initiation requires Partner API access.');
  }

  async refundPayment(organizationId: string, providerTransactionId: string, amount: number): Promise<PaymentResult> {
    throw new NotImplementedException('Zeller refunds require Partner API access.');
  }
}
