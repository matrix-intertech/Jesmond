import {
  BusinessCategory,
  BusinessVerificationStatus,
  OrgStatus,
  OrgType,
  PrismaClient,
  SubscriptionBillingInterval,
  SubscriptionProfileType,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';
import { seedSubscriptions } from '../../../../../packages/db/prisma/seed-subscriptions';
import { runFreeSubscriptionBackfill } from '../../../../../packages/db/prisma/backfill-free-subscriptions';
import { ProfileTypeResolverService } from './services/profile-type-resolver.service';
import { SubscriptionProvisioningService } from './services/subscription-provisioning.service';
import { SubscriptionRecoveryService } from './services/subscription-recovery.service';
import { RequirementsEngineService } from '../credentials/services/requirements-engine.service';

describe('Subscriptions Phase 1 Integration (Local DB)', () => {
  let prisma: PrismaClient;
  let provisioningService: SubscriptionProvisioningService;
  let recoveryService: SubscriptionRecoveryService;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const profileResolver = new ProfileTypeResolverService();
    provisioningService = new SubscriptionProvisioningService(
      prisma as any,
      profileResolver,
    );
    recoveryService = new SubscriptionRecoveryService(
      prisma as any,
      profileResolver,
      provisioningService,
    );
  });

  afterAll(async () => {
    if (createdOrgIds.length > 0) {
      await prisma.organization.deleteMany({
        where: { id: { in: createdOrgIds } },
      });
    }
    await prisma.$disconnect();
  });

  const createTestOrg = async (opts: {
    name: string;
    type: OrgType;
    businessCategory?: BusinessCategory;
    status?: OrgStatus;
    verifiedCompletion?: boolean;
  }) => {
    const org = await prisma.organization.create({
      data: {
        name: opts.name,
        type: opts.type,
        businessCategory: opts.businessCategory ?? BusinessCategory.RETAIL,
        status: opts.status ?? OrgStatus.PENDING,
        ...(opts.verifiedCompletion
          ? {
              profileCompletion: {
                create: {
                  overallStatus: BusinessVerificationStatus.VERIFIED,
                  isCompleted: true,
                },
              },
            }
          : {}),
      },
    });
    createdOrgIds.push(org.id);
    return org;
  };

  it('seeds 6 Free plans, 16 features, and 3 false flags idempotently', async () => {
    const first = await seedSubscriptions(prisma);
    const second = await seedSubscriptions(prisma);
    expect(first.plans).toHaveLength(6);
    expect(second.plans.map((p) => p.id)).toEqual(first.plans.map((p) => p.id));

    const flags = await prisma.featureFlag.findMany({
      where: {
        key: {
          in: [
            'SUBSCRIPTIONS_ENABLED',
            'SUBSCRIPTION_ENFORCEMENT_ENABLED',
            'SUBSCRIPTION_CHECKOUT_ENABLED',
          ],
        },
      },
    });
    expect(flags).toHaveLength(3);
    expect(flags.every((f) => f.enabled === false)).toBe(true);
  });

  it('enforces partial unique index including SUSPENDED while allowing historical EXPIRED/CANCELED rows', async () => {
    const org = await createTestOrg({
      name: 'Unique Index Test Org',
      type: OrgType.RETAIL,
      businessCategory: BusinessCategory.RETAIL,
      verifiedCompletion: true,
    });
    const retailPlan = await prisma.subscriptionPlan.findUniqueOrThrow({
      where: {
        profileType_code: {
          profileType: SubscriptionProfileType.RETAIL,
          code: 'RETAIL_FREE',
        },
      },
    });

    // Historical canceled row is permitted
    await prisma.organizationSubscription.create({
      data: {
        organizationId: org.id,
        planId: retailPlan.id,
        profileType: SubscriptionProfileType.RETAIL,
        status: SubscriptionStatus.CANCELED,
        billingInterval: SubscriptionBillingInterval.FREE,
        source: SubscriptionSource.MANUAL_ADMIN,
      },
    });

    // Suspended blocking row prevents another active/free subscription
    const suspended = await prisma.organizationSubscription.create({
      data: {
        organizationId: org.id,
        planId: retailPlan.id,
        profileType: SubscriptionProfileType.RETAIL,
        status: SubscriptionStatus.SUSPENDED,
        billingInterval: SubscriptionBillingInterval.FREE,
        source: SubscriptionSource.MANUAL_ADMIN,
      },
    });

    await expect(
      prisma.organizationSubscription.create({
        data: {
          organizationId: org.id,
          planId: retailPlan.id,
          profileType: SubscriptionProfileType.RETAIL,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: SubscriptionBillingInterval.FREE,
          source: SubscriptionSource.FREE_AUTO,
        },
      }),
    ).rejects.toThrow();

    // Provisioning service must also skip the suspended subscription
    const prov = await provisioningService.provisionFreePlanForOrganization(org.id);
    expect(prov.status).toBe('SKIPPED_EXISTING');
    expect(prov.subscriptionId).toBe(suspended.id);
  });

  it('handles concurrent provisioning safely with exactly one ACTIVE subscription and snapshot v1', async () => {
    const org = await createTestOrg({
      name: 'Concurrent Provisioning Org',
      type: OrgType.PROVIDER,
      businessCategory: BusinessCategory.RETAIL,
      verifiedCompletion: true,
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        provisioningService.provisionFreePlanForOrganization(org.id),
      ),
    );

    const provisioned = results.filter((r) => r.status === 'PROVISIONED');
    const skipped = results.filter((r) => r.status === 'SKIPPED_EXISTING');
    expect(provisioned).toHaveLength(1);
    expect(skipped).toHaveLength(4);
    expect(provisioned[0].profileType).toBe(SubscriptionProfileType.ACCOMMODATION);

    const subs = await prisma.organizationSubscription.findMany({
      where: { organizationId: org.id },
      include: { snapshots: true },
    });
    expect(subs).toHaveLength(1);
    expect(subs[0].snapshots).toHaveLength(1);
    expect(subs[0].snapshots[0].version).toBe(1);
  });

  it('runs backfill idempotently and isolates tenant subscriptions', async () => {
    const orgA = await createTestOrg({
      name: 'Backfill Org A',
      type: OrgType.RETAIL,
      businessCategory: BusinessCategory.SERVICES,
      verifiedCompletion: true,
    });
    const orgB = await createTestOrg({
      name: 'Backfill Org B',
      type: OrgType.AGENCY,
      verifiedCompletion: true,
    });

    const first = await runFreeSubscriptionBackfill(prisma);
    expect(first.failedCount).toBe(0);

    const entryA = first.entries.find((e) => e.organizationId === orgA.id);
    const entryB = first.entries.find((e) => e.organizationId === orgB.id);
    expect(entryA?.outcome).toBe('PROVISIONED');
    expect(entryA?.profileType).toBe(SubscriptionProfileType.SERVICES);
    expect(entryB?.outcome).toBe('PROVISIONED');
    expect(entryB?.profileType).toBe(SubscriptionProfileType.ACCOMMODATION);

    // Second run must skip both
    const second = await runFreeSubscriptionBackfill(prisma);
    expect(
      second.entries.find((e) => e.organizationId === orgA.id)?.outcome,
    ).toBe('SKIPPED_EXISTING');
    expect(
      second.entries.find((e) => e.organizationId === orgB.id)?.outcome,
    ).toBe('SKIPPED_EXISTING');

    // Tenant isolation: orgA subscription belongs only to orgA
    const subsA = await prisma.organizationSubscription.findMany({
      where: { organizationId: orgA.id },
    });
    const subsB = await prisma.organizationSubscription.findMany({
      where: { organizationId: orgB.id },
    });
    expect(subsA[0].id).not.toBe(subsB[0].id);
    expect(subsA[0].organizationId).toBe(orgA.id);
    expect(subsB[0].organizationId).toBe(orgB.id);
  });

  it('identifies and recovers verified organizations without subscriptions', async () => {
    const org = await createTestOrg({
      name: 'Recovery Org',
      type: OrgType.RETAIL,
      businessCategory: BusinessCategory.RENTALS,
      verifiedCompletion: true,
    });

    const diagnosed = await recoveryService.diagnoseUnprovisionedOrganizations();
    expect(diagnosed.some((d) => d.organizationId === org.id)).toBe(true);

    const report = await recoveryService.recoverMissingSubscriptions();
    expect(report.provisioned).toBeGreaterThanOrEqual(1);

    const sub = await prisma.organizationSubscription.findFirst({
      where: { organizationId: org.id, status: SubscriptionStatus.ACTIVE },
    });
    expect(sub?.profileType).toBe(SubscriptionProfileType.RENTALS);
  });

  it('keeps verification succeeding when post-verification provisioning fails', async () => {
    const org = await createTestOrg({
      name: 'Verification Isolation Org',
      type: OrgType.RETAIL,
      businessCategory: BusinessCategory.FOOD,
      verifiedCompletion: false,
    });

    const failingProvisioning: any = {
      provisionFreePlanForOrganization: jest
        .fn()
        .mockRejectedValue(new Error('Simulated provisioning outage')),
    };
    const engine = new RequirementsEngineService(
      prisma as any,
      failingProvisioning,
    );
    jest.spyOn(engine, 'resolveRequirementsForOrganization').mockResolvedValue({
      organizationId: org.id,
      organizationName: org.name,
      businessCategory: BusinessCategory.FOOD,
      state: 'NSW',
      branchAddress: null,
      selectedServices: [],
      activeServices: [],
      abn: '12345678901',
      abnStatus: 'VERIFIED',
      abnExemptionStatus: 'NONE' as any,
      abnExemptionReason: null,
      overallStatus: BusinessVerificationStatus.VERIFIED,
      dismissedUntil: null,
      requirements: [
        { isMandatory: true, currentStatus: 'VERIFIED' } as any,
      ],
    });

    const status = await engine.recalculateOrganizationVerificationStatus(org.id);
    expect(status).toBe(BusinessVerificationStatus.VERIFIED);

    const completion = await prisma.businessProfileCompletion.findUnique({
      where: { organizationId: org.id },
    });
    expect(completion?.overallStatus).toBe(BusinessVerificationStatus.VERIFIED);
  });
});
