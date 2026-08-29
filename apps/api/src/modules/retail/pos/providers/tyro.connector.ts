import { BasePosConnector } from './base.connector';
import { PosConnectorCapabilities, PaymentIntent, PaymentResult } from '../pos-connector.interface';

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
    // Implement official Tyro webhook verification (e.g. HMAC-SHA256 signature checking)
    return true;
  }

  parseWebhookEvent(payload: any): { eventId: string; type: string; data: any } {
    return {
      eventId: payload.id || '',
      type: payload.eventType || '',
      data: payload,
    };
  }

  async pairTerminal(organizationId: string, providerTerminalId: string): Promise<boolean> {
    // Official Tyro pairing flow requires initiating a pairing request from POS and confirming on terminal
    console.log(`[Tyro] Initiating pairing for terminal ${providerTerminalId}`);
    return true;
  }

  async initiatePayment(organizationId: string, intent: PaymentIntent): Promise<PaymentResult> {
    // Call Tyro Connect API to initiate payment
    console.log(`[Tyro] Initiating payment ${intent.internalPaymentIntentId} for ${intent.amount}`);
    return {
      status: 'PENDING',
      providerTransactionId: `tyro_txn_${Date.now()}`
    };
  }

  async refundPayment(organizationId: string, providerTransactionId: string, amount: number): Promise<PaymentResult> {
    console.log(`[Tyro] Refunding ${amount} for txn ${providerTransactionId}`);
    return {
      status: 'PENDING',
      providerTransactionId: `tyro_ref_${Date.now()}`
    };
  }
}
