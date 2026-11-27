import {
  SubscriptionBillingInterval,
  SubscriptionPlanTier,
  SubscriptionProfileType,
  SubscriptionTaxBehavior,
} from '@prisma/client';
import {
  computeAudIntervalPricesMinor,
  SEED_FREE_PLANS,
  SEED_PAID_PLANS,
  SEED_SUBSCRIPTION_FEATURES,
  seedSubscriptions,
  SUBSCRIPTION_GLOBAL_FLAGS,
} from '../../../../../packages/db/prisma/seed-subscriptions';

describe('Subscription Plans & AUD Pricing Seed', () => {
  it('defines exactly 6 Free plans + 12 Paid plans = 18 plans (3 per profile)', () => {
    expect(SEED_FREE_PLANS).toHaveLength(6);
    expect(SEED_PAID_PLANS).toHaveLength(12);

    const profiles = Object.values(SubscriptionProfileType);
    expect(profiles).toHaveLength(6);

    for (const profile of profiles) {
      const freeForProfile = SEED_FREE_PLANS.filter((p) => p.profileType === profile);
      const paidForProfile = SEED_PAID_PLANS.filter((p) => p.profileType === profile);
      expect(freeForProfile).toHaveLength(1);
      expect(paidForProfile).toHaveLength(2);
      expect(paidForProfile.map((p) => p.tier).sort()).toEqual([
        SubscriptionPlanTier.PRO,
        SubscriptionPlanTier.STANDARD,
      ]);
    }
  });

  it('computes exact AUD minor-unit prices for Monthly, Quarterly (-5%), and Annual (-15%)', () => {
    expect(computeAudIntervalPricesMinor(4900)).toEqual([
      { interval: SubscriptionBillingInterval.MONTHLY, unitAmountMinor: 4900 },
      { interval: SubscriptionBillingInterval.QUARTERLY, unitAmountMinor: 13965 },
      { interval: SubscriptionBillingInterval.ANNUAL, unitAmountMinor: 49980 },
    ]);

    expect(computeAudIntervalPricesMinor(2900)).toEqual([
      { interval: SubscriptionBillingInterval.MONTHLY, unitAmountMinor: 2900 },
      { interval: SubscriptionBillingInterval.QUARTERLY, unitAmountMinor: 8265 },
      { interval: SubscriptionBillingInterval.ANNUAL, unitAmountMinor: 29580 },
    ]);

    const expectedMonthlyByCode: Record<string, number> = {
      ACCOMMODATION_GROWTH: 4900,
      ACCOMMODATION_PRO: 9900,
      RETAIL_GROWTH: 3900,
      RETAIL_PRO: 8900,
      FOOD_GROWTH: 3900,
      FOOD_PRO: 7900,
      MECHANICS_GROWTH: 3900,
      MECHANICS_PRO: 8900,
      SERVICES_GROWTH: 2900,
      SERVICES_PRO: 6900,
      RENTALS_GROWTH: 3900,
      RENTALS_PRO: 8900,
    };

    for (const plan of SEED_PAID_PLANS) {
      expect(plan.monthlyAmountMinor).toBe(expectedMonthlyByCode[plan.code]);
    }
  });

  it('references only valid profile-applicable features in all 18 plans', () => {
    const featureMap = new Map(SEED_SUBSCRIPTION_FEATURES.map((f) => [f.key, f]));
    for (const plan of [...SEED_FREE_PLANS, ...SEED_PAID_PLANS]) {
      for (const limit of plan.limits) {
        const feat = featureMap.get(limit.featureKey);
        expect(feat).toBeDefined();
        expect(feat!.applicableProfiles).toContain(plan.profileType);
      }
    }
  });

  it('executes seedSubscriptions idempotently without duplicate plans/prices or enabling flags', async () => {
    const flags = new Map<string, any>();
    const features = new Map<string, any>();
    const plans = new Map<string, any>();
    const limits = new Map<string, any>();
    const prices: any[] = [];

    const prisma = {
      featureFlag: {
        upsert: jest.fn(async ({ where, create }: any) => {
          if (!flags.has(where.key)) {
            flags.set(where.key, { ...create });
          }
          return flags.get(where.key);
        }),
      },
      subscriptionFeature: {
        upsert: jest.fn(async ({ where, create }: any) => {
          if (!features.has(where.key)) {
            features.set(where.key, { id: `feat-${where.key}`, ...create });
          }
          return features.get(where.key);
        }),
      },
      subscriptionPlan: {
        upsert: jest.fn(async ({ where, create }: any) => {
          const k = `${where.profileType_code.profileType}:${where.profileType_code.code}`;
          if (!plans.has(k)) {
            plans.set(k, { id: `plan-${k}`, ...create });
          }
          return plans.get(k);
        }),
      },
      planFeatureLimit: {
        upsert: jest.fn(async ({ where, create }: any) => {
          const k = `${where.planId_planVersion_featureId.planId}:${where.planId_planVersion_featureId.planVersion}:${where.planId_planVersion_featureId.featureId}`;
          if (!limits.has(k)) {
            limits.set(k, { id: `lim-${k}`, ...create });
          }
          return limits.get(k);
        }),
      },
      subscriptionPlanPrice: {
        findFirst: jest.fn(async ({ where }: any) =>
          prices.find(
            (p) =>
              p.planId === where.planId &&
              p.interval === where.interval &&
              p.currency === where.currency,
          ) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `price-${prices.length + 1}`, ...data };
          prices.push(row);
          return row;
        }),
      },
    } as any;

    const first = await seedSubscriptions(prisma);
    expect(first.plans).toHaveLength(18);
    expect(first.seededPricesCount).toBe(36);
    expect(prices).toHaveLength(36);
    for (const p of prices) {
      expect(p.currency).toBe('AUD');
      expect(p.currencyDecimals).toBe(2);
      expect(p.taxBehavior).toBe(SubscriptionTaxBehavior.UNSPECIFIED);
      expect(p.taxRateBps).toBeNull();
    }
    for (const k of SUBSCRIPTION_GLOBAL_FLAGS) {
      expect(flags.get(k).enabled).toBe(false);
    }

    // Second execution is idempotent
    const second = await seedSubscriptions(prisma);
    expect(second.plans).toHaveLength(18);
    expect(second.seededPricesCount).toBe(0);
    expect(plans.size).toBe(18);
    expect(prices).toHaveLength(36);
  });
});
