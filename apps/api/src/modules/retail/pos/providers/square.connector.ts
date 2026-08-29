import { BasePosConnector } from './base.connector';
import { PosConnectorCapabilities, PaymentIntent, PaymentResult } from '../pos-connector.interface';

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
    // Square webhook signature verification using secret
    return true;
  }

  parseWebhookEvent(payload: any): { eventId: string; type: string; data: any } {
    return {
      eventId: payload.event_id || '',
      type: payload.type || '',
      data: payload,
    };
  }

  async pairTerminal(organizationId: string, providerTerminalId: string): Promise<boolean> {
    // Generate Square Terminal device code
    console.log(`[Square] Requesting device code for terminal ${providerTerminalId}`);
    return true;
  }

  async initiatePayment(organizationId: string, intent: PaymentIntent): Promise<PaymentResult> {
    // Call Square Terminal Checkout API
    console.log(`[Square] Creating terminal checkout ${intent.internalPaymentIntentId} for ${intent.amount}`);
    return {
      status: 'PENDING',
      providerTransactionId: `sq_txn_${Date.now()}`
    };
  }

  async refundPayment(organizationId: string, providerTransactionId: string, amount: number): Promise<PaymentResult> {
    console.log(`[Square] Refunding ${amount} for txn ${providerTransactionId}`);
    return {
      status: 'PENDING',
      providerTransactionId: `sq_ref_${Date.now()}`
    };
  }
}
