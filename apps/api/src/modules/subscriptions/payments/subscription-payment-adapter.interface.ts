export interface CreateSubscriptionCheckoutParams {
  organizationId: string;
  planId: string;
  planCode: string;
  planName: string;
  planPriceId: string;
  unitAmountMinor: number;
  currency: string;
  interval: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  customerEmail?: string;
  externalCustomerId?: string | null;
}

export interface CreateSubscriptionCheckoutResult {
  sessionId: string;
  checkoutUrl: string;
}

export interface ParsedStripeWebhookEvent {
  id: string;
  type: string;
  created: number;
  dataObject: Record<string, any>;
}

export interface SubscriptionPaymentAdapter {
  readonly providerName: string;
  isConfigured(): boolean;
  isWebhookConfigured(): boolean;
  createCheckoutSession(
    params: CreateSubscriptionCheckoutParams,
  ): Promise<CreateSubscriptionCheckoutResult>;
  verifyAndParseWebhook(
    rawBody: Buffer,
    signature: string,
  ): ParsedStripeWebhookEvent;
  cancelExternalSubscription(
    externalSubscriptionId: string,
    immediate: boolean,
  ): Promise<void>;
  refundPayment(params: {
    externalPaymentId: string;
    amountMinor?: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string; status: string }>;
}
