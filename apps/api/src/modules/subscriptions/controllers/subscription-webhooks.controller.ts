import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { SubscriptionBillingService } from '../services/subscription-billing.service';

@Controller('subscriptions/webhooks')
export class SubscriptionWebhooksController {
  constructor(private readonly billingService: SubscriptionBillingService) {}

  @Post('stripe')
  async handleStripeWebhook(
    @Req() req: { rawBody?: Buffer; body?: any },
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody =
      req.rawBody ??
      (Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body ?? {})));

    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Empty webhook payload');
    }

    return this.billingService.processStripeWebhook(rawBody, signature);
  }
}
