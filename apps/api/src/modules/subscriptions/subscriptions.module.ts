import { Global, Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminSubscriptionPermissionGuard } from './auth/admin-subscription-permissions';
import { AdminSubscriptionsController } from './controllers/admin-subscriptions.controller';
import { OrgSubscriptionsController } from './controllers/org-subscriptions.controller';
import { PublicPricingController } from './controllers/public-pricing.controller';
import { SubscriptionCheckoutController } from './controllers/subscription-checkout.controller';
import { SubscriptionWebhooksController } from './controllers/subscription-webhooks.controller';
import { StripePaymentGateway } from '../retail/payments/gateways/stripe-payment.gateway';
import { StripeSubscriptionAdapter } from './payments/stripe-subscription.adapter';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { SubscriptionGuard } from './guards/subscription.guard';
import { AdminSubscriptionsService } from './services/admin-subscriptions.service';
import { EnterpriseOverrideService } from './services/enterprise-override.service';
import { EntitlementResolverService } from './services/entitlement-resolver.service';
import { EntitlementSnapshotService } from './services/entitlement-snapshot.service';
import { ProfileTypeResolverService } from './services/profile-type-resolver.service';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { SubscriptionProvisioningService } from './services/subscription-provisioning.service';
import { SubscriptionRecoveryService } from './services/subscription-recovery.service';
import { SubscriptionStatusService } from './services/subscription-status.service';
import { UsageCounterService } from './services/usage-counter.service';

@Global()
@Module({
  imports: [PrismaModule, AdminModule],
  controllers: [
    OrgSubscriptionsController,
    AdminSubscriptionsController,
    PublicPricingController,
    SubscriptionCheckoutController,
    SubscriptionWebhooksController,
  ],
  providers: [
    StripePaymentGateway,
    StripeSubscriptionAdapter,
    SubscriptionBillingService,
    ProfileTypeResolverService,
    SubscriptionProvisioningService,
    SubscriptionRecoveryService,
    SubscriptionStatusService,
    EntitlementSnapshotService,
    EntitlementResolverService,
    EnterpriseOverrideService,
    SubscriptionLifecycleService,
    AdminSubscriptionsService,
    UsageCounterService,
    SubscriptionBillingService,
    StripeSubscriptionAdapter,
    SubscriptionGuard,
    AdminSubscriptionPermissionGuard,
  ],
  exports: [
    ProfileTypeResolverService,
    SubscriptionProvisioningService,
    SubscriptionRecoveryService,
    SubscriptionStatusService,
    EntitlementSnapshotService,
    EntitlementResolverService,
    EnterpriseOverrideService,
    SubscriptionLifecycleService,
    AdminSubscriptionsService,
    UsageCounterService,
    SubscriptionBillingService,
    StripeSubscriptionAdapter,
    SubscriptionGuard,
    AdminSubscriptionPermissionGuard,
  ],
})
export class SubscriptionsModule {}
