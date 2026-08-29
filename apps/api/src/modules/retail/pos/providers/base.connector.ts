import { PosConnector, PosConnectorCapabilities, PaymentIntent, PaymentResult } from '../pos-connector.interface';

export abstract class BasePosConnector implements PosConnector {
  abstract getCapabilities(): PosConnectorCapabilities;

  async connect(organizationId: string, credentials: any): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async disconnect(organizationId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async testConnection(organizationId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async syncProducts(organizationId: string): Promise<void> {
    // Optional sync
  }

  async syncInventory(organizationId: string): Promise<void> {
    // Optional sync
  }

  async syncCustomers(organizationId: string): Promise<void> {
    // Optional sync
  }

  async syncOrders(organizationId: string): Promise<void> {
    // Optional sync
  }

  async syncPayments(organizationId: string): Promise<void> {
    // Optional sync
  }

  abstract verifyWebhookSignature(request: { headers: any; body: any; rawBody?: Buffer }, secret: string): boolean;

  abstract parseWebhookEvent(payload: any): { eventId: string; type: string; data: any };
}
