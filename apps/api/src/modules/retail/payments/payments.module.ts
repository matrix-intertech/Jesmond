import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentSettingsController } from './payment-settings.controller';
import { StripePaymentGateway } from './gateways/stripe-payment.gateway';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [forwardRef(() => MarketplaceModule)],
  providers: [PaymentsService, PaymentSettingsService, StripePaymentGateway],
  controllers: [PaymentsController, PaymentSettingsController],
  exports: [PaymentsService, PaymentSettingsService, StripePaymentGateway]
})
export class PaymentsModule {}
