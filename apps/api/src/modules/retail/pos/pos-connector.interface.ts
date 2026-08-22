export interface PosConnector {
  connect(organizationId: string, credentials: any): Promise<boolean>;
  disconnect(organizationId: string): Promise<boolean>;
  testConnection(organizationId: string): Promise<boolean>;
  syncProducts(organizationId: string): Promise<void>;
  syncInventory(organizationId: string): Promise<void>;
  syncCustomers(organizationId: string): Promise<void>;
  syncOrders(organizationId: string): Promise<void>;
  syncPayments(organizationId: string): Promise<void>;
  verifyWebhookSignature(payload: any, signature: string, secret: string): boolean;
  parseWebhookEvent(payload: any): { eventId: string; type: string; data: any };
}
