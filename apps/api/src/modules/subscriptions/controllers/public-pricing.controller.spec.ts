import { SubscriptionProfileType } from '@prisma/client';
import { PublicPricingController } from './public-pricing.controller';

describe('PublicPricingController (Unit)', () => {
  it('hides plan catalog when SUBSCRIPTIONS_ENABLED is false', async () => {
    const prisma: any = {
      subscriptionPlan: { findMany: jest.fn() },
    };
    const flags: any = {
      isEnabled: jest.fn().mockResolvedValue(false),
    };
    const controller = new PublicPricingController(prisma, flags);

    const res = await controller.getPublicPricing('RETAIL');
    expect(res).toEqual({
      subscriptionsEnabled: false,
      checkoutEnabled: false,
      plans: [],
    });
    expect(prisma.subscriptionPlan.findMany).not.toHaveBeenCalled();
  });

  it('returns only active public plans filtered by profile when SUBSCRIPTIONS_ENABLED is true', async () => {
    const prisma: any = {
      subscriptionPlan: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'plan-1',
            profileType: SubscriptionProfileType.RETAIL,
            code: 'RETAIL_FREE',
            name: 'Retail Free',
            description: 'Starter',
            tier: 'FREE',
            isFree: true,
            isEnterprise: false,
            planVersion: 1,
            prices: [],
            featureLimits: [
              {
                planVersion: 1,
                enabled: true,
                limitValue: 1,
                feature: {
                  key: 'RETAIL_BRANCHES',
                  name: 'Business Branches',
                  description: null,
                  valueType: 'NUMERIC_LIMIT',
                  applicableProfiles: [SubscriptionProfileType.RETAIL],
                },
              },
            ],
          },
        ]),
      },
    };
    const flags: any = {
      isEnabled: jest.fn(async (k: string) => k === 'SUBSCRIPTIONS_ENABLED'),
    };
    const controller = new PublicPricingController(prisma, flags);

    const res = await controller.getPublicPricing('retail');
    expect(prisma.subscriptionPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          isPublic: true,
          profileType: SubscriptionProfileType.RETAIL,
        },
      }),
    );
    expect(res.subscriptionsEnabled).toBe(true);
    expect(res.checkoutEnabled).toBe(false);
    expect(res.plans).toHaveLength(1);
    expect(res.plans[0].features[0].limitValue).toBe(1);
  });
});
