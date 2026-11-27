import {
  BadRequestException,
} from '@nestjs/common';
import {
  BusinessCategory,
  BusinessVerificationStatus,
  OrgType,
  PrismaClient,
  SubscriptionActorType,
  SubscriptionBillingInterval,
  SubscriptionProfileType,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';
import { FeatureFlagService } from '../admin/feature-flag.service';
import { EnterpriseOverrideService } from './services/enterprise-override.service';
import { EntitlementResolverService } from './services/entitlement-resolver.service';
import { EntitlementSnapshotService } from './services/entitlement-snapshot.service';
import { ProfileTypeResolverService } from './services/profile-type-resolver.service';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { SubscriptionProvisioningService } from './services/subscription-provisioning.service';
import { SubscriptionStatusService } from './services/subscription-status.service';

describe('Subscriptions Phase 2 Integration (Local DB)', () => {
  let prisma: PrismaClient;
  let provisioning: SubscriptionProvisioningService;
  let snapshotService: EntitlementSnapshotService;
  let resolverService: EntitlementResolverService;
  let overrideService: EnterpriseOverrideService;
  let lifecycleService: SubscriptionLifecycleService;
  let featureFlagService: FeatureFlagService;
  const createdOrgIds: string[] = [];
  const createdPlanIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const profileResolver = new ProfileTypeResolverService();
    const statusService = new SubscriptionStatusService();
    provisioning = new SubscriptionProvisioningService(
      prisma as any,
      profileResolver,
    );
    snapshotService = new EntitlementSnapshotService(prisma as any);
    resolverService = new EntitlementResolverService(
      prisma as any,
      profileResolver,
      statusService,
      snapshotService,
    );
    overrideService = new EnterpriseOverrideService(
      prisma as any,
      snapshotService,
    );
    lifecycleService = new SubscriptionLifecycleService(
      prisma as any,
      statusService,
      snapshotService,
      profileResolver,
    );
    featureFlagService = new FeatureFlagService(prisma as any);
  });

  afterAll(async () => {
    if (createdOrgIds.length > 0) {
      await prisma.organization.deleteMany({
        where: { id: { in: createdOrgIds } },
      });
    }
    if (createdPlanIds.length > 0) {
      await prisma.subscriptionPlan.deleteMany({
        where: { id: { in: createdPlanIds } },
      });
    }
    await prisma.$disconnect();
  });

  const createVerifiedOrg = async (
    name: string,
    type: OrgType = OrgType.RETAIL,
    category: BusinessCategory = BusinessCategory.RETAIL,
  ) => {
    const org = await prisma.organization.create({
      data: {
        name,
        type,
        businessCategory: category,
        profileCompletion: {
          create: {
            overallStatus: BusinessVerificationStatus.VERIFIED,
            isCompleted: true,
          },
        },
      },
    });
    createdOrgIds.push(org.id);
    return org;
  };

  it('keeps all three global flags OFF and enforces checkout dependency rule', async () => {
    expect(await featureFlagService.isEnabled('SUBSCRIPTIONS_ENABLED')).toBe(
      false,
    );
    expect(
      await featureFlagService.isEnabled('SUBSCRIPTION_ENFORCEMENT_ENABLED'),
    ).toBe(false);
    expect(
      await featureFlagService.isEnabled('SUBSCRIPTION_CHECKOUT_ENABLED'),
    ).toBe(false);

    await expect(
      featureFlagService.setFeatureState(
        'SUBSCRIPTION_CHECKOUT_ENABLED',
        true,
        'test-admin',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('serializes simultaneous snapshot mutations cleanly with monotonic immutable versions', async () => {
    const org = await createVerifiedOrg(
      'Concurrent Snapshot Org',
      OrgType.PROVIDER,
    );
    const prov = await provisioning.provisionFreePlanForOrganization(org.id);
    expect(prov.status).toBe('PROVISIONED');

    const subId = prov.subscriptionId!;
    const t1 = new Date();

    await Promise.all([
      overrideService.upsertOverride({
        organizationId: org.id,
        subscriptionId: subId,
        featureKey: 'ACCOMMODATION_LISTINGS',
        enabled: true,
        limitValue: 25,
        reason: 'Concurrent enterprise bump 1',
        actorId: 'admin-1',
      }),
      overrideService.upsertOverride({
        organizationId: org.id,
        subscriptionId: subId,
        featureKey: 'AGENCY_CUSTOM_ROLES',
        enabled: true,
        limitValue: null,
        reason: 'Concurrent enterprise bump 2',
        actorId: 'admin-1',
      }),
    ]);

    const snapshots = await prisma.subscriptionEntitlementSnapshot.findMany({
      where: { subscriptionId: subId },
      orderBy: { version: 'asc' },
    });

    expect(snapshots.map((s) => s.version)).toEqual([1, 2, 3]);
    expect(snapshots[1].previousSnapshotId).toBe(snapshots[0].id);
    expect(snapshots[2].previousSnapshotId).toBe(snapshots[1].id);
    // Append-only: v1 and v2 are never mutated to set effectiveTo
    expect(snapshots[0].effectiveTo).toBeNull();
    expect(snapshots[1].effectiveTo).toBeNull();

    const historical = await snapshotService.getSnapshotAtTimestamp(
      subId,
      org.id,
      t1,
    );
    expect(historical?.version).toBe(1);
  });

  it('serializes simultaneous lifecycle transitions and prevents double-transition', async () => {
    const org = await createVerifiedOrg('Concurrent Lifecycle Org');
    const retailPlan = await prisma.subscriptionPlan.findUniqueOrThrow({
      where: {
        profileType_code: {
          profileType: SubscriptionProfileType.RETAIL,
          code: 'RETAIL_FREE',
        },
      },
    });

    const sub = await prisma.organizationSubscription.create({
      data: {
        organizationId: org.id,
        planId: retailPlan.id,
        profileType: SubscriptionProfileType.RETAIL,
        status: SubscriptionStatus.ACTIVE,
        billingInterval: SubscriptionBillingInterval.MONTHLY,
        source: SubscriptionSource.MANUAL_ADMIN,
        currentPeriodEnd: new Date(Date.now() + 86400_000),
      },
    });

    const outcomes = await Promise.allSettled([
      lifecycleService.suspendSubscription(sub.id, org.id, {
        actorId: 'admin-1',
        reason: 'Race 1',
      }),
      lifecycleService.suspendSubscription(sub.id, org.id, {
        actorId: 'admin-2',
        reason: 'Race 2',
      }),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('handles 7-day grace period, renewal during grace, and cross-org isolation', async () => {
    const orgA = await createVerifiedOrg('Grace Org A', OrgType.RETAIL, BusinessCategory.FOOD);
    const orgB = await createVerifiedOrg('Isolation Org B', OrgType.RETAIL, BusinessCategory.FOOD);

    const menuFeature = await prisma.subscriptionFeature.findUniqueOrThrow({
      where: { key: 'FOOD_MENU_MANAGEMENT' },
    });
    const paidFoodPlan = await prisma.subscriptionPlan.create({
      data: {
        profileType: SubscriptionProfileType.FOOD,
        code: `FOOD_PRO_TEST_${Date.now()}`,
        name: 'Food Pro Test',
        tier: 'PRO',
        isFree: false,
        isEnterprise: false,
        featureLimits: {
          create: {
            planVersion: 1,
            featureId: menuFeature.id,
            enabled: true,
            limitValue: null,
          },
        },
      },
    });
    createdPlanIds.push(paidFoodPlan.id);

    const periodEnd = new Date('2026-11-01T00:00:00.000Z');
    const subA = await prisma.organizationSubscription.create({
      data: {
        organizationId: orgA.id,
        planId: paidFoodPlan.id,
        profileType: SubscriptionProfileType.FOOD,
        status: SubscriptionStatus.ACTIVE,
        billingInterval: SubscriptionBillingInterval.MONTHLY,
        source: SubscriptionSource.MANUAL_ADMIN,
        currentPeriodEnd: periodEnd,
      },
    });
    await snapshotService.createEntitlementSnapshot({
      subscriptionId: subA.id,
      organizationId: orgA.id,
      reason: 'Initial paid food test',
    });

    await lifecycleService.enterGracePeriod(
      subA.id,
      orgA.id,
      { actorId: 'system', actorType: SubscriptionActorType.SYSTEM },
      new Date('2026-11-02T00:00:00.000Z'),
    );

    const duringGrace = await resolverService.resolveForOrganization(orgA.id, {
      at: new Date('2026-11-07T23:59:59.000Z'),
    });
    expect(duringGrace.effectiveAccessActive).toBe(true);
    expect(duringGrace.entitlements.FOOD_MENU_MANAGEMENT.enabled).toBe(true);

    // Renew during grace
    await lifecycleService.renewSubscription(
      subA.id,
      orgA.id,
      new Date('2026-11-08T00:00:00.000Z'),
      new Date('2026-12-08T00:00:00.000Z'),
      { actorId: 'admin-1', reason: 'Verified renewal' },
    );

    const renewed = await resolverService.getCurrentSubscriptionSummary(orgA.id);
    expect(renewed.status).toBe(SubscriptionStatus.ACTIVE);
    expect(renewed.graceEndsAt).toBeNull();

    // Cross-org isolation: orgB cannot mutate orgA's overrides
    await expect(
      overrideService.upsertOverride({
        organizationId: orgB.id,
        subscriptionId: subA.id,
        featureKey: 'FOOD_MENU_MANAGEMENT',
        enabled: false,
        limitValue: null,
        reason: 'Cross-tenant probe',
        actorId: 'attacker',
      }),
    ).rejects.toThrow();
  });
});
