import { Controller, Get, Optional, Query } from '@nestjs/common';
import { SubscriptionProfileType } from '@prisma/client';
import { FeatureFlagService } from '../../admin/feature-flag.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionBillingService } from '../services/subscription-billing.service';

@Controller('subscriptions/public')
export class PublicPricingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagService: FeatureFlagService,
    @Optional() private readonly billingService?: SubscriptionBillingService,
  ) {}

  private async isCheckoutReadyForPublic(
    subscriptionsEnabled: boolean,
    hasPurchasablePlans?: boolean,
  ): Promise<boolean> {
    if (!subscriptionsEnabled) {
      return false;
    }

    let baseReady: boolean;
    if (this.billingService) {
      const readiness = await this.billingService.getBillingReadiness();
      baseReady = readiness.checkoutReady;
    } else {
      const [checkoutEnabled, paymentsBooking] = await Promise.all([
        this.featureFlagService.isEnabled('SUBSCRIPTION_CHECKOUT_ENABLED'),
        this.featureFlagService.isEnabled('PAYMENTS_BOOKING'),
      ]);
      baseReady = checkoutEnabled && paymentsBooking;
    }

    if (!baseReady) {
      return false;
    }

    if (hasPurchasablePlans !== undefined) {
      return hasPurchasablePlans;
    }

    const purchasableCount = await this.prisma.subscriptionPlan.count({
      where: {
        isActive: true,
        isPublic: true,
        isFree: false,
        isEnterprise: false,
        prices: {
          some: {
            isActive: true,
            interval: { in: ['MONTHLY', 'QUARTERLY', 'ANNUAL'] },
          },
        },
      },
    });
    return purchasableCount > 0;
  }

  @Get('config')
  async getPublicConfig() {
    const subscriptionsEnabled = await this.featureFlagService.isEnabled(
      'SUBSCRIPTIONS_ENABLED',
    );
    const checkoutEnabled = await this.isCheckoutReadyForPublic(
      subscriptionsEnabled,
    );
    return {
      subscriptionsEnabled,
      checkoutEnabled,
    };
  }

  @Get('pricing')
  async getPublicPricing(@Query('profile') profile?: string) {
    const subscriptionsEnabled = await this.featureFlagService.isEnabled(
      'SUBSCRIPTIONS_ENABLED',
    );

    if (!subscriptionsEnabled) {
      return {
        subscriptionsEnabled: false,
        checkoutEnabled: false,
        plans: [],
      };
    }

    const normalizedProfile = profile?.trim().toUpperCase();
    const validProfile = Object.values(SubscriptionProfileType).includes(
      normalizedProfile as SubscriptionProfileType,
    )
      ? (normalizedProfile as SubscriptionProfileType)
      : undefined;

    const plans = await this.prisma.subscriptionPlan.findMany({
      where: {
        isActive: true,
        isPublic: true,
        ...(validProfile ? { profileType: validProfile } : {}),
      },
      orderBy: [{ profileType: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        profileType: true,
        code: true,
        name: true,
        description: true,
        tier: true,
        isFree: true,
        isEnterprise: true,
        planVersion: true,
        prices: {
          where: { isActive: true },
          orderBy: [{ interval: 'asc' }, { currency: 'asc' }],
          select: {
            id: true,
            interval: true,
            unitAmountMinor: true,
            currency: true,
            currencyDecimals: true,
            taxBehavior: true,
          },
        },
        featureLimits: {
          where: { feature: { isActive: true } },
          select: {
            planVersion: true,
            enabled: true,
            limitValue: true,
            feature: {
              select: {
                key: true,
                name: true,
                description: true,
                valueType: true,
                applicableProfiles: true,
              },
            },
          },
        },
      },
    });

    const hasPurchasablePlans = plans.some(
      (plan) =>
        !plan.isFree &&
        !plan.isEnterprise &&
        plan.prices.some(
          (p) =>
            p.interval === 'MONTHLY' ||
            p.interval === 'QUARTERLY' ||
            p.interval === 'ANNUAL',
        ),
    );

    const checkoutEnabled = await this.isCheckoutReadyForPublic(
      true,
      hasPurchasablePlans,
    );

    return {
      subscriptionsEnabled: true,
      checkoutEnabled,
      plans: plans.map((plan) => ({
        id: plan.id,
        profileType: plan.profileType,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        tier: plan.tier,
        isFree: plan.isFree,
        isEnterprise: plan.isEnterprise,
        prices: plan.prices,
        features: plan.featureLimits
          .filter(
            (l) =>
              l.planVersion === plan.planVersion &&
              l.feature.applicableProfiles.includes(plan.profileType),
          )
          .map((l) => ({
            key: l.feature.key,
            name: l.feature.name,
            description: l.feature.description,
            valueType: l.feature.valueType,
            enabled: l.enabled,
            limitValue: l.limitValue,
            unlimited: l.enabled && l.limitValue === null && l.feature.valueType === 'NUMERIC_LIMIT',
          })),
      })),
    };
  }
}
