export interface PosConnectorCapabilities {
  terminalManagement: boolean;
  paymentInitiation: boolean;
  refunds: boolean;
  webhookEvents: boolean;
  terminalStatus: boolean;
  receipts: boolean;
  offlineMode: boolean;
}

export interface PaymentIntent {
  internalPaymentIntentId: string;
  amount: number;
  currency: string;
  providerTerminalId: string;
  idempotencyKey: string;
}

export interface PaymentResult {
  status: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'CANCELLED';
  providerTransactionId?: string;
  error?: string;
}

export interface PosConnector {
  getCapabilities(): PosConnectorCapabilities;

  // Legacy sync methods
  connect(organizationId: string, credentials: any): Promise<boolean>;
  disconnect(organizationId: string): Promise<boolean>;
  testConnection(organizationId: string): Promise<boolean>;
  syncProducts(organizationId: string): Promise<void>;
  syncInventory(organizationId: string): Promise<void>;
  syncCustomers(organizationId: string): Promise<void>;
  syncOrders(organizationId: string): Promise<void>;
  syncPayments(organizationId: string): Promise<void>;

  // Webhooks
  verifyWebhookSignature(request: { headers: any; body: any; rawBody?: Buffer }, secret: string): boolean;
  parseWebhookEvent(payload: any): { eventId: string; type: string; data: any };

  // Terminal Management
  registerTerminal?(organizationId: string, terminalData: any): Promise<string>;
  pairTerminal?(organizationId: string, providerTerminalId: string): Promise<boolean>;
  activateTerminal?(organizationId: string, providerTerminalId: string): Promise<boolean>;
  getTerminalStatus?(organizationId: string, providerTerminalId: string): Promise<string>;

  // Payment Lifecycle
  initiatePayment?(organizationId: string, intent: PaymentIntent): Promise<PaymentResult>;
  cancelPayment?(organizationId: string, providerTransactionId: string): Promise<boolean>;
  refundPayment?(organizationId: string, providerTransactionId: string, amount: number): Promise<PaymentResult>;
  getPaymentStatus?(organizationId: string, providerTransactionId: string): Promise<PaymentResult>;
}
