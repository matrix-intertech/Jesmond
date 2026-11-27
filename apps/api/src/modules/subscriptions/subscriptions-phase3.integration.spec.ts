import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  BusinessCategory,
  BusinessVerificationStatus,
  OrgType,
  PrismaClient,
  SubscriptionBillingInterval,
  SubscriptionPlanTier,
  SubscriptionProfileType,
  UserRole,
} from '@prisma/client';
import { FeatureFlagService } from '../admin/feature-flag.service';
import {
  AdminSubscriptionPermission,
  AdminSubscriptionPermissionGuard,
  ADMIN_SUBSCRIPTION_PERMISSIONS_KEY,
} from './auth/admin-subscription-permissions';
import { AdminSubscriptionsService } from './services/admin-subscriptions.service';
import { EnterpriseOverrideService } from './services/enterprise-override.service';
import { EntitlementResolverService } from './services/entitlement-resolver.service';
import { EntitlementSnapshotService } from './services/entitlement-snapshot.service';
import { ProfileTypeResolverService } from './services/profile-type-resolver.service';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { SubscriptionProvisioningService } from './services/subscription-provisioning.service';
import { SubscriptionStatusService } from './services/subscription-status.service';
import { UsageCounterService } from './services/usage-counter.service';

describe('Subscriptions Phase 3 Integration (Admin, Permissions & Atomic Usage)', () => {
  let prisma: PrismaClient;
  let adminService: AdminSubscriptionsService;
  let usageService: UsageCounterService;
  let provisioning: SubscriptionProvisioningService;
  let permissionGuard: AdminSubscriptionPermissionGuard;
  const createdOrgIds: string[] = [];
  const createdPlanIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const profileResolver = new ProfileTypeResolverService();
    const statusService = new SubscriptionStatusService();
    const snapshotService = new EntitlementSnapshotService(prisma as any);
    const entitlementResolver = new EntitlementResolverService(
      prisma as any,
      profileResolver,
      statusService,
      snapshotService,
    );
    const overrideService = new EnterpriseOverrideService(
      prisma as any,
      snapshotService,
    );
    const lifecycleService = new SubscriptionLifecycleService(
      prisma as any,
      statusService,
      snapshotService,
      profileResolver,
    );
    const featureFlagService = new FeatureFlagService(prisma as any);
    adminService = new AdminSubscriptionsService(
      prisma as any,
      lifecycleService,
      overrideService,
      featureFlagService,
    );
    usageService = new UsageCounterService(
      prisma as any,
      featureFlagService,
      entitlementResolver,
    );
    provisioning = new SubscriptionProvisioningService(
      prisma as any,
      profileResolver,
    );
    const reflector = {
      getAllAndOverride: jest.fn(
        () => [AdminSubscriptionPermission.SUBSCRIPTION_PLANS_MANAGE],
      ),
    } as unknown as Reflector;
    permissionGuard = new AdminSubscriptionPermissionGuard(
      reflector,
      prisma as any,
    );
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

  it('preserves historical price versions and plan versions across updates', async () => {
    const plan = await adminService.createPlan(
      {
        profileType: SubscriptionProfileType.RETAIL,
        code: `RETAIL_PRO_P3_${Date.now()}`,
        name: 'Retail Pro P3',
        tier: SubscriptionPlanTier.PRO,
      },
      'super-admin-1',
    );
    createdPlanIds.push(plan.id);

    const p1 = await adminService.upsertPlanPrice(
      plan.id,
      {
        interval: SubscriptionBillingInterval.MONTHLY,
        unitAmountMinor: 4900,
        currency: 'AUD',
      },
      'super-admin-1',
    );
    const p2 = await adminService.upsertPlanPrice(
      plan.id,
      {
        interval: SubscriptionBillingInterval.MONTHLY,
        unitAmountMinor: 5900,
        currency: 'AUD',
      },
      'super-admin-1',
    );
    const pUsd = await adminService.upsertPlanPrice(
      plan.id,
      {
        interval: SubscriptionBillingInterval.ANNUAL,
        unitAmountMinor: 49900,
        currency: 'USD',
      },
      'super-admin-1',
    );

    expect(p1.priceVersion).toBe(1);
    expect(p2.priceVersion).toBe(2);
    expect(pUsd.currency).toBe('USD');

    const oldP1 = await prisma.subscriptionPlanPrice.findUniqueOrThrow({
      where: { id: p1.id },
    });
    expect(oldP1.isActive).toBe(false);
    expect(oldP1.unitAmountMinor).toBe(4900);

    const feat = await prisma.subscriptionFeature.findUniqueOrThrow({
      where: { key: 'RETAIL_BRANCHES' },
    });
    const versionedPlan = await adminService.updatePlanFeatureLimits(
      plan.id,
      [{ featureId: feat.id, enabled: true, limitValue: 5 }],
      'super-admin-1',
    );
    expect(versionedPlan.planVersion).toBe(2);
  });

  it('enforces AdminSubscriptionPermissionGuard for ADMIN vs SUPER_ADMIN', async () => {
    const ctx = (user: any): ExecutionContext =>
      ({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      }) as any;

    await expect(
      permissionGuard.canActivate(ctx({ role: UserRole.SUPER_ADMIN })),
    ).resolves.toBe(true);

    await expect(
      permissionGuard.canActivate(
        ctx({ role: UserRole.ADMIN, permissions: [] }),
      ),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      permissionGuard.canActivate(
        ctx({
          role: UserRole.ADMIN,
          permissions: [AdminSubscriptionPermission.SUBSCRIPTION_PLANS_MANAGE],
        }),
      ),
    ).resolves.toBe(true);
  });

  it('serializes concurrent quota requests and prevents exceeding limit=1', async () => {
    const org = await prisma.organization.create({
      data: {
        name: 'Atomic Quota Org',
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.RETAIL,
        profileCompletion: {
          create: {
            overallStatus: BusinessVerificationStatus.VERIFIED,
            isCompleted: true,
          },
        },
      },
    });
    createdOrgIds.push(org.id);

    await provisioning.provisionFreePlanForOrganization(org.id);

    // Simulate two concurrent creations racing against limit=1
    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        usageService.consumeQuotaInTransaction(tx, {
          organizationId: org.id,
          featureKey: 'RETAIL_BRANCHES',
          limitValue: 1,
          enforce: true,
          profileType: SubscriptionProfileType.RETAIL,
        }),
      ),
      prisma.$transaction((tx) =>
        usageService.consumeQuotaInTransaction(tx, {
          organizationId: org.id,
          featureKey: 'RETAIL_BRANCHES',
          limitValue: 1,
          enforce: true,
          profileType: SubscriptionProfileType.RETAIL,
        }),
      ),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Zero limit blocks creation
    await expect(
      prisma.$transaction((tx) =>
        usageService.consumeQuotaInTransaction(tx, {
          organizationId: org.id,
          featureKey: 'RETAIL_PRODUCTS',
          limitValue: 0,
          enforce: true,
          profileType: SubscriptionProfileType.RETAIL,
        }),
      ),
    ).rejects.toThrow(ForbiddenException);

    // Unlimited (null) allows increment
    const unlim = await prisma.$transaction((tx) =>
      usageService.consumeQuotaInTransaction(tx, {
        organizationId: org.id,
        featureKey: 'RETAIL_PRODUCTS',
        limitValue: null,
        enforce: true,
        profileType: SubscriptionProfileType.RETAIL,
      }),
    );
    expect(unlim.currentCount).toBe(1);

    // Decrement on deletion/archival
    await prisma.$transaction((tx) =>
      usageService.decrementCounterInTransaction(tx, org.id, 'RETAIL_BRANCHES', 1),
    );
    const afterDec = await prisma.subscriptionUsageCounter.findUniqueOrThrow({
      where: {
        organizationId_featureKey: {
          organizationId: org.id,
          featureKey: 'RETAIL_BRANCHES',
        },
      },
    });
    expect(afterDec.currentCount).toBe(0);

    // Reconcile against actual DB rows
    const reconciled = await usageService.reconcileOrganizationCounters(org.id);
    expect(reconciled.RETAIL_BRANCHES).toBe(0);
  });
});
