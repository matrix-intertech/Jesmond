export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}

export interface PaymentGateway {
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<{
    id: string;
    clientSecret: string;
  }>;
}
