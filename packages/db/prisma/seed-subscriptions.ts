import {
  PrismaClient,
  SubscriptionBillingInterval,
  SubscriptionFeatureValueType,
  SubscriptionPlanTier,
  SubscriptionProfileType,
  SubscriptionTaxBehavior,
} from '@prisma/client';

export interface SeedFeatureDef {
  key: string;
  name: string;
  description: string;
  valueType: SubscriptionFeatureValueType;
  applicableProfiles: SubscriptionProfileType[];
}

export interface SeedFreePlanDef {
  profileType: SubscriptionProfileType;
  code: string;
  name: string;
  description: string;
  limits: Array<{
    featureKey: string;
    enabled: boolean;
    limitValue: number | null;
  }>;
}

export interface SeedPaidPlanDef {
  profileType: SubscriptionProfileType;
  code: string;
  name: string;
  description: string;
  tier: SubscriptionPlanTier;
  sortOrder: number;
  monthlyAmountMinor: number;
  limits: Array<{
    featureKey: string;
    enabled: boolean;
    limitValue: number | null;
  }>;
}

export function computeAudIntervalPricesMinor(monthlyAmountMinor: number): Array<{
  interval: SubscriptionBillingInterval;
  unitAmountMinor: number;
}> {
  return [
    {
      interval: SubscriptionBillingInterval.MONTHLY,
      unitAmountMinor: monthlyAmountMinor,
    },
    {
      interval: SubscriptionBillingInterval.QUARTERLY,
      unitAmountMinor: Math.round(monthlyAmountMinor * 3 * 0.95),
    },
    {
      interval: SubscriptionBillingInterval.ANNUAL,
      unitAmountMinor: Math.round(monthlyAmountMinor * 12 * 0.85),
    },
  ];
}

export const SUBSCRIPTION_GLOBAL_FLAGS = [
  'SUBSCRIPTIONS_ENABLED',
  'SUBSCRIPTION_ENFORCEMENT_ENABLED',
  'SUBSCRIPTION_CHECKOUT_ENABLED',
] as const;

export const SEED_SUBSCRIPTION_FEATURES: SeedFeatureDef[] = [
  {
    key: 'ACCOMMODATION_LISTINGS',
    name: 'Property Listings',
    description: 'Maximum number of accommodation properties.',
    valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
    applicableProfiles: [SubscriptionProfileType.ACCOMMODATION],
  },
  {
    key: 'ACCOMMODATION_ROOMS',
    name: 'Rooms & Units',
    description: 'Maximum number of rooms across accommodation properties.',
    valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
    applicableProfiles: [SubscriptionProfileType.ACCOMMODATION],
  },
  {
    key: 'AGENCY_TEAM_MEMBERS',
    name: 'Team Members',
    description: 'Maximum number of organization staff members.',
    valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
    applicableProfiles: [SubscriptionProfileType.ACCOMMODATION],
  },
  {
    key: 'AGENCY_CUSTOM_ROLES',
    name: 'Custom Agency Roles',
    description: 'Ability to create and manage custom agency RBAC roles.',
    valueType: SubscriptionFeatureValueType.BOOLEAN,
    applicableProfiles: [SubscriptionProfileType.ACCOMMODATION],
  },
  {
    key: 'LEAD_MANAGEMENT',
    name: 'Lead Management',
    description: 'Ability to manage and assign accommodation leads.',
    valueType: SubscriptionFeatureValueType.BOOLEAN,
    applicableProfiles: [SubscriptionProfileType.ACCOMMODATION],
  },
  {
    key: 'RETAIL_BRANCHES',
    name: 'Business Branches',
    description: 'Maximum number of physical business branches.',
    valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
    applicableProfiles: [
      SubscriptionProfileType.RETAIL,
      SubscriptionProfileType.FOOD,
      SubscriptionProfileType.MECHANICS,
      SubscriptionProfileType.SERVICES,
      SubscriptionProfileType.RENTALS,
    ],
  },
  {
    key: 'RETAIL_PRODUCTS',
    name: 'Catalog Products',
    description: 'Maximum number of retail catalog products.',
    valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
    applicableProfiles: [SubscriptionProfileType.RETAIL],
  },
  {
    key: 'RETAIL_POS_TERMINALS',
    name: 'POS Terminals',
    description: 'Maximum number of paired POS terminals.',
    valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
    applicableProfiles: [SubscriptionProfileType.RETAIL],
  },
  {
    key: 'RETAIL_EMPLOYEES',
    name: 'Retail Employees',
    description: 'Maximum number of retail staff accounts.',
    valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
    applicableProfiles: [SubscriptionProfileType.RETAIL],
  },
  {
    key: 'RETAIL_ORDERS',
    name: 'Retail Orders & Customers',
    description: 'Ability to create and manage retail orders and customers.',
    valueType: SubscriptionFeatureValueType.BOOLEAN,
    applicableProfiles: [SubscriptionProfileType.RETAIL],
  },
  {
    key: 'RETAIL_INVENTORY',
    name: 'Inventory Management',
    description: 'Ability to adjust and receive retail stock.',
    valueType: SubscriptionFeatureValueType.BOOLEAN,
    applicableProfiles: [SubscriptionProfileType.RETAIL],
  },
  {
    key: 'FOOD_MENU_MANAGEMENT',
    name: 'Food Menu Management',
    description: 'Ability to create and update food menus, categories, and items.',
    valueType: SubscriptionFeatureValueType.BOOLEAN,
    applicableProfiles: [SubscriptionProfileType.FOOD],
  },
  {
    key: 'FOOD_ORDER_FULFILLMENT',
    name: 'Food Order Fulfillment',
    description: 'Ability to manage incoming food order statuses.',
    valueType: SubscriptionFeatureValueType.BOOLEAN,
    applicableProfiles: [SubscriptionProfileType.FOOD],
  },
  {
    key: 'APPOINTMENT_SERVICES',
    name: 'Bookable Services',
    description: 'Maximum number of bookable services.',
    valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
    applicableProfiles: [
      SubscriptionProfileType.MECHANICS,
      SubscriptionProfileType.SERVICES,
    ],
  },
  {
    key: 'APPOINTMENT_STAFF',
    name: 'Appointment Staff',
    description: 'Maximum number of staff profiles for appointments.',
    valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
    applicableProfiles: [
      SubscriptionProfileType.MECHANICS,
      SubscriptionProfileType.SERVICES,
    ],
  },
  {
    key: 'APPOINTMENT_BOOKINGS',
    name: 'Appointment Management',
    description: 'Ability to approve, reject, reschedule, and create offline bookings.',
    valueType: SubscriptionFeatureValueType.BOOLEAN,
    applicableProfiles: [
      SubscriptionProfileType.MECHANICS,
      SubscriptionProfileType.SERVICES,
    ],
  },
];

export const SEED_FREE_PLANS: SeedFreePlanDef[] = [
  {
    profileType: SubscriptionProfileType.ACCOMMODATION,
    code: 'ACCOMMODATION_FREE',
    name: 'Accommodation Free',
    description: 'Starter free plan for accommodation providers and agencies.',
    limits: [
      { featureKey: 'ACCOMMODATION_LISTINGS', enabled: true, limitValue: 3 },
      { featureKey: 'ACCOMMODATION_ROOMS', enabled: true, limitValue: 10 },
      { featureKey: 'AGENCY_TEAM_MEMBERS', enabled: true, limitValue: 2 },
      { featureKey: 'AGENCY_CUSTOM_ROLES', enabled: false, limitValue: null },
      { featureKey: 'LEAD_MANAGEMENT', enabled: true, limitValue: null },
    ],
  },
  {
    profileType: SubscriptionProfileType.RETAIL,
    code: 'RETAIL_FREE',
    name: 'Retail Free',
    description: 'Starter free plan for retail businesses.',
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 1 },
      { featureKey: 'RETAIL_PRODUCTS', enabled: true, limitValue: 25 },
      { featureKey: 'RETAIL_POS_TERMINALS', enabled: true, limitValue: 1 },
      { featureKey: 'RETAIL_EMPLOYEES', enabled: true, limitValue: 3 },
      { featureKey: 'RETAIL_ORDERS', enabled: true, limitValue: null },
      { featureKey: 'RETAIL_INVENTORY', enabled: true, limitValue: null },
    ],
  },
  {
    profileType: SubscriptionProfileType.FOOD,
    code: 'FOOD_FREE',
    name: 'Food Free',
    description: 'Starter free plan for food businesses.',
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 1 },
      { featureKey: 'FOOD_MENU_MANAGEMENT', enabled: true, limitValue: null },
      { featureKey: 'FOOD_ORDER_FULFILLMENT', enabled: true, limitValue: null },
    ],
  },
  {
    profileType: SubscriptionProfileType.MECHANICS,
    code: 'MECHANICS_FREE',
    name: 'Mechanics Free',
    description: 'Starter free plan for automotive and mechanics workshops.',
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 1 },
      { featureKey: 'APPOINTMENT_SERVICES', enabled: true, limitValue: 5 },
      { featureKey: 'APPOINTMENT_STAFF', enabled: true, limitValue: 3 },
      { featureKey: 'APPOINTMENT_BOOKINGS', enabled: true, limitValue: null },
    ],
  },
  {
    profileType: SubscriptionProfileType.SERVICES,
    code: 'SERVICES_FREE',
    name: 'Services Free',
    description: 'Starter free plan for service providers.',
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 1 },
      { featureKey: 'APPOINTMENT_SERVICES', enabled: true, limitValue: 5 },
      { featureKey: 'APPOINTMENT_STAFF', enabled: true, limitValue: 3 },
      { featureKey: 'APPOINTMENT_BOOKINGS', enabled: true, limitValue: null },
    ],
  },
  {
    profileType: SubscriptionProfileType.RENTALS,
    code: 'RENTALS_FREE',
    name: 'Rentals Free',
    description: 'Starter free plan for rental businesses.',
    limits: [{ featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 1 }],
  },
];

export const SEED_PAID_PLANS: SeedPaidPlanDef[] = [
  // 1. ACCOMMODATION
  {
    profileType: SubscriptionProfileType.ACCOMMODATION,
    code: 'ACCOMMODATION_GROWTH',
    name: 'Accommodation Growth',
    description: 'Expanded listings, rooms, team members, and custom agency roles.',
    tier: SubscriptionPlanTier.STANDARD,
    sortOrder: 1,
    monthlyAmountMinor: 4900,
    limits: [
      { featureKey: 'ACCOMMODATION_LISTINGS', enabled: true, limitValue: 10 },
      { featureKey: 'ACCOMMODATION_ROOMS', enabled: true, limitValue: 50 },
      { featureKey: 'AGENCY_TEAM_MEMBERS', enabled: true, limitValue: 5 },
      { featureKey: 'AGENCY_CUSTOM_ROLES', enabled: true, limitValue: null },
      { featureKey: 'LEAD_MANAGEMENT', enabled: true, limitValue: null },
    ],
  },
  {
    profileType: SubscriptionProfileType.ACCOMMODATION,
    code: 'ACCOMMODATION_PRO',
    name: 'Accommodation Professional',
    description: 'High-capacity accommodation and agency operations plan.',
    tier: SubscriptionPlanTier.PRO,
    sortOrder: 2,
    monthlyAmountMinor: 9900,
    limits: [
      { featureKey: 'ACCOMMODATION_LISTINGS', enabled: true, limitValue: 30 },
      { featureKey: 'ACCOMMODATION_ROOMS', enabled: true, limitValue: 200 },
      { featureKey: 'AGENCY_TEAM_MEMBERS', enabled: true, limitValue: 15 },
      { featureKey: 'AGENCY_CUSTOM_ROLES', enabled: true, limitValue: null },
      { featureKey: 'LEAD_MANAGEMENT', enabled: true, limitValue: null },
    ],
  },
  // 2. RETAIL
  {
    profileType: SubscriptionProfileType.RETAIL,
    code: 'RETAIL_GROWTH',
    name: 'Retail Growth',
    description: 'Multi-branch retail catalog, POS terminals, and staff scaling.',
    tier: SubscriptionPlanTier.STANDARD,
    sortOrder: 1,
    monthlyAmountMinor: 3900,
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 3 },
      { featureKey: 'RETAIL_PRODUCTS', enabled: true, limitValue: 250 },
      { featureKey: 'RETAIL_POS_TERMINALS', enabled: true, limitValue: 3 },
      { featureKey: 'RETAIL_EMPLOYEES', enabled: true, limitValue: 10 },
      { featureKey: 'RETAIL_ORDERS', enabled: true, limitValue: null },
      { featureKey: 'RETAIL_INVENTORY', enabled: true, limitValue: null },
    ],
  },
  {
    profileType: SubscriptionProfileType.RETAIL,
    code: 'RETAIL_PRO',
    name: 'Retail Professional',
    description: 'Full-scale multi-store retail operations and POS fleet.',
    tier: SubscriptionPlanTier.PRO,
    sortOrder: 2,
    monthlyAmountMinor: 8900,
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 10 },
      { featureKey: 'RETAIL_PRODUCTS', enabled: true, limitValue: 2000 },
      { featureKey: 'RETAIL_POS_TERMINALS', enabled: true, limitValue: 10 },
      { featureKey: 'RETAIL_EMPLOYEES', enabled: true, limitValue: 50 },
      { featureKey: 'RETAIL_ORDERS', enabled: true, limitValue: null },
      { featureKey: 'RETAIL_INVENTORY', enabled: true, limitValue: null },
    ],
  },
  // 3. FOOD (Customer orders remain CASH-only; only supported features configured)
  {
    profileType: SubscriptionProfileType.FOOD,
    code: 'FOOD_GROWTH',
    name: 'Food Growth',
    description: 'Multi-location food menu management and order fulfillment.',
    tier: SubscriptionPlanTier.STANDARD,
    sortOrder: 1,
    monthlyAmountMinor: 3900,
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 3 },
      { featureKey: 'FOOD_MENU_MANAGEMENT', enabled: true, limitValue: null },
      { featureKey: 'FOOD_ORDER_FULFILLMENT', enabled: true, limitValue: null },
    ],
  },
  {
    profileType: SubscriptionProfileType.FOOD,
    code: 'FOOD_PRO',
    name: 'Food Professional',
    description: 'High-volume multi-branch hospitality and food operations.',
    tier: SubscriptionPlanTier.PRO,
    sortOrder: 2,
    monthlyAmountMinor: 7900,
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 10 },
      { featureKey: 'FOOD_MENU_MANAGEMENT', enabled: true, limitValue: null },
      { featureKey: 'FOOD_ORDER_FULFILLMENT', enabled: true, limitValue: null },
    ],
  },
  // 4. MECHANICS
  {
    profileType: SubscriptionProfileType.MECHANICS,
    code: 'MECHANICS_GROWTH',
    name: 'Mechanics Growth',
    description: 'Growing workshop plan with expanded services, staff, and branches.',
    tier: SubscriptionPlanTier.STANDARD,
    sortOrder: 1,
    monthlyAmountMinor: 3900,
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 3 },
      { featureKey: 'APPOINTMENT_SERVICES', enabled: true, limitValue: 20 },
      { featureKey: 'APPOINTMENT_STAFF', enabled: true, limitValue: 10 },
      { featureKey: 'APPOINTMENT_BOOKINGS', enabled: true, limitValue: null },
    ],
  },
  {
    profileType: SubscriptionProfileType.MECHANICS,
    code: 'MECHANICS_PRO',
    name: 'Mechanics Professional',
    description: 'Multi-site automotive workshop operations and large service teams.',
    tier: SubscriptionPlanTier.PRO,
    sortOrder: 2,
    monthlyAmountMinor: 8900,
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 10 },
      { featureKey: 'APPOINTMENT_SERVICES', enabled: true, limitValue: 100 },
      { featureKey: 'APPOINTMENT_STAFF', enabled: true, limitValue: 30 },
      { featureKey: 'APPOINTMENT_BOOKINGS', enabled: true, limitValue: null },
    ],
  },
  // 5. SERVICES
  {
    profileType: SubscriptionProfileType.SERVICES,
    code: 'SERVICES_GROWTH',
    name: 'Services Growth',
    description: 'Expanded appointment catalog, staff scheduling, and branches.',
    tier: SubscriptionPlanTier.STANDARD,
    sortOrder: 1,
    monthlyAmountMinor: 2900,
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 3 },
      { featureKey: 'APPOINTMENT_SERVICES', enabled: true, limitValue: 20 },
      { featureKey: 'APPOINTMENT_STAFF', enabled: true, limitValue: 10 },
      { featureKey: 'APPOINTMENT_BOOKINGS', enabled: true, limitValue: null },
    ],
  },
  {
    profileType: SubscriptionProfileType.SERVICES,
    code: 'SERVICES_PRO',
    name: 'Services Professional',
    description: 'Multi-branch professional services booking and team management.',
    tier: SubscriptionPlanTier.PRO,
    sortOrder: 2,
    monthlyAmountMinor: 6900,
    limits: [
      { featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 10 },
      { featureKey: 'APPOINTMENT_SERVICES', enabled: true, limitValue: 100 },
      { featureKey: 'APPOINTMENT_STAFF', enabled: true, limitValue: 30 },
      { featureKey: 'APPOINTMENT_BOOKINGS', enabled: true, limitValue: null },
    ],
  },
  // 6. RENTALS (Only RETAIL_BRANCHES is currently implemented; rental-specific quotas pending)
  {
    profileType: SubscriptionProfileType.RENTALS,
    code: 'RENTALS_GROWTH',
    name: 'Rentals Growth',
    description: 'Multi-branch rental business plan.',
    tier: SubscriptionPlanTier.STANDARD,
    sortOrder: 1,
    monthlyAmountMinor: 3900,
    limits: [{ featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 3 }],
  },
  {
    profileType: SubscriptionProfileType.RENTALS,
    code: 'RENTALS_PRO',
    name: 'Rentals Professional',
    description: 'Large multi-branch rental operations plan.',
    tier: SubscriptionPlanTier.PRO,
    sortOrder: 2,
    monthlyAmountMinor: 8900,
    limits: [{ featureKey: 'RETAIL_BRANCHES', enabled: true, limitValue: 10 }],
  },
];

export async function seedSubscriptions(prisma: PrismaClient) {
  // 1. Seed global subscription FeatureFlags with default false (never overwrite existing values)
  for (const key of SUBSCRIPTION_GLOBAL_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key },
      update: {},
      create: {
        key,
        enabled: false,
        updatedBy: 'system',
      },
    });
  }

  // 2. Seed Feature Catalog (never overwrite manually customized definitions)
  const featureIdByKey = new Map<string, string>();
  for (const feat of SEED_SUBSCRIPTION_FEATURES) {
    const record = await prisma.subscriptionFeature.upsert({
      where: { key: feat.key },
      update: {},
      create: {
        key: feat.key,
        name: feat.name,
        description: feat.description,
        valueType: feat.valueType,
        applicableProfiles: feat.applicableProfiles,
        isActive: true,
      },
    });
    featureIdByKey.set(feat.key, record.id);
  }

  // 3. Seed 6 independent Free plans + baseline limits
  const seededPlans: Array<{ id: string; code: string; profileType: SubscriptionProfileType }> = [];
  for (const planDef of SEED_FREE_PLANS) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: {
        profileType_code: {
          profileType: planDef.profileType,
          code: planDef.code,
        },
      },
      update: {},
      create: {
        profileType: planDef.profileType,
        code: planDef.code,
        planVersion: 1,
        name: planDef.name,
        description: planDef.description,
        tier: SubscriptionPlanTier.FREE,
        isFree: true,
        isEnterprise: false,
        isActive: true,
        isPublic: true,
        gracePeriodDays: 7,
        sortOrder: 0,
      },
    });

    for (const limit of planDef.limits) {
      const featureId = featureIdByKey.get(limit.featureKey);
      if (!featureId) continue;

      await prisma.planFeatureLimit.upsert({
        where: {
          planId_planVersion_featureId: {
            planId: plan.id,
            planVersion: plan.planVersion,
            featureId,
          },
        },
        update: {},
        create: {
          planId: plan.id,
          planVersion: plan.planVersion,
          featureId,
          enabled: limit.enabled,
          limitValue: limit.limitValue,
        },
      });
    }

    seededPlans.push({
      id: plan.id,
      code: plan.code,
      profileType: plan.profileType,
    });
  }

  // 4. Seed 12 Growth & Professional plans + AUD prices (Monthly, Quarterly -5%, Annual -15%) + limits
  let seededPricesCount = 0;
  for (const planDef of SEED_PAID_PLANS) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: {
        profileType_code: {
          profileType: planDef.profileType,
          code: planDef.code,
        },
      },
      update: {},
      create: {
        profileType: planDef.profileType,
        code: planDef.code,
        planVersion: 1,
        name: planDef.name,
        description: planDef.description,
        tier: planDef.tier,
        isFree: false,
        isEnterprise: false,
        isActive: true,
        isPublic: true,
        gracePeriodDays: 7,
        sortOrder: planDef.sortOrder,
      },
    });

    for (const limit of planDef.limits) {
      const featureId = featureIdByKey.get(limit.featureKey);
      if (!featureId) continue;

      await prisma.planFeatureLimit.upsert({
        where: {
          planId_planVersion_featureId: {
            planId: plan.id,
            planVersion: plan.planVersion,
            featureId,
          },
        },
        update: {},
        create: {
          planId: plan.id,
          planVersion: plan.planVersion,
          featureId,
          enabled: limit.enabled,
          limitValue: limit.limitValue,
        },
      });
    }

    const intervalPrices = computeAudIntervalPricesMinor(planDef.monthlyAmountMinor);
    for (const priceDef of intervalPrices) {
      const existingPrice = await prisma.subscriptionPlanPrice.findFirst({
        where: {
          planId: plan.id,
          interval: priceDef.interval,
          currency: 'AUD',
        },
      });

      if (!existingPrice) {
        await prisma.subscriptionPlanPrice.create({
          data: {
            planId: plan.id,
            priceVersion: 1,
            interval: priceDef.interval,
            unitAmountMinor: priceDef.unitAmountMinor,
            currency: 'AUD',
            currencyDecimals: 2,
            taxBehavior: SubscriptionTaxBehavior.UNSPECIFIED,
            taxRateBps: null,
            isActive: true,
          },
        });
        seededPricesCount += 1;
      }
    }

    seededPlans.push({
      id: plan.id,
      code: plan.code,
      profileType: plan.profileType,
    });
  }

  return {
    flagsCount: SUBSCRIPTION_GLOBAL_FLAGS.length,
    featuresCount: featureIdByKey.size,
    plans: seededPlans,
    seededPricesCount,
  };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedSubscriptions(prisma)
    .then((result) => {
      console.log('Subscription seed completed:', JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error('Subscription seed failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
