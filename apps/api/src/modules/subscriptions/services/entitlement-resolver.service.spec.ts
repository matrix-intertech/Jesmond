import {
  BusinessCategory,
  OrgStatus,
  OrgType,
  SubscriptionBillingInterval,
  SubscriptionFeatureValueType,
  SubscriptionProfileType,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';
import { SubscriptionErrorCode } from '../errors/subscription-domain.error';
import { EntitlementResolverService } from './entitlement-resolver.service';
import { EntitlementSnapshotService } from './entitlement-snapshot.service';
import { ProfileTypeResolverService } from './profile-type-resolver.service';
import { SubscriptionStatusService } from './subscription-status.service';

describe('EntitlementResolverService (Unit)', () => {
  const makeService = () => {
    const prisma: any = {
      organization: { findUnique: jest.fn() },
      organizationSubscription: { findFirst: jest.fn() },
      subscriptionEntitlementSnapshot: { findFirst: jest.fn() },
      organizationEntitlementOverride: { findMany: jest.fn() },
      subscriptionUsageCounter: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const statusService = new SubscriptionStatusService();
    const snapshotService = new EntitlementSnapshotService(prisma);
    const service = new EntitlementResolverService(
      prisma,
      new ProfileTypeResolverService(),
      statusService,
      snapshotService,
    );
    return { prisma, service, snapshotService };
  };

  it.each([
    [OrgType.PROVIDER, BusinessCategory.RETAIL, SubscriptionProfileType.ACCOMMODATION],
    [OrgType.RETAIL, BusinessCategory.RETAIL, SubscriptionProfileType.RETAIL],
    [OrgType.RETAIL, BusinessCategory.FOOD, SubscriptionProfileType.FOOD],
    [OrgType.RETAIL, BusinessCategory.MECHANICS, SubscriptionProfileType.MECHANICS],
    [OrgType.RETAIL, BusinessCategory.SERVICES, SubscriptionProfileType.SERVICES],
    [OrgType.RETAIL, BusinessCategory.RENTALS, SubscriptionProfileType.RENTALS],
  ])(
    'resolves entitlements for %s / %s -> %s',
    async (orgType, category, profileType) => {
      const { prisma, service } = makeService();
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        type: orgType,
        status: OrgStatus.VERIFIED,
        businessCategory: category,
        deletedAt: null,
      });
      prisma.organizationSubscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        organizationId: 'org-1',
        profileType,
        status: SubscriptionStatus.ACTIVE,
        billingInterval: SubscriptionBillingInterval.FREE,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        graceEndsAt: null,
        canceledAt: null,
        planVersion: 1,
        currentSnapshotId: 'snap-1',
        plan: {
          id: 'plan-1',
          code: `${profileType}_FREE`,
          isFree: true,
          featureLimits: [
            {
              planVersion: 1,
              enabled: true,
              limitValue: 1,
              feature: {
                key: 'RETAIL_BRANCHES',
                isActive: true,
                valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
                applicableProfiles: [profileType],
              },
            },
          ],
        },
      });
      prisma.subscriptionEntitlementSnapshot.findFirst.mockResolvedValue({
        id: 'snap-1',
        version: 1,
      });
      prisma.organizationEntitlementOverride.findMany.mockResolvedValue([]);

      const result = await service.resolveForOrganization('org-1');
      expect(result.profileType).toBe(profileType);
      expect(result.entitlements.RETAIL_BRANCHES).toEqual({
        featureKey: 'RETAIL_BRANCHES',
        enabled: true,
        limitValue: 1,
        currentUsage: 0,
        unlimited: false,
        source: 'PLAN',
        overrideExpiresAt: null,
      });
    },
  );

  it('applies override precedence, zero limits, and never marks disabled features unlimited', async () => {
    const { prisma, service } = makeService();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-ent',
      type: OrgType.PROVIDER,
      status: OrgStatus.VERIFIED,
      businessCategory: BusinessCategory.RETAIL,
      deletedAt: null,
    });
    prisma.organizationSubscription.findFirst.mockResolvedValue({
      id: 'sub-ent',
      organizationId: 'org-ent',
      profileType: SubscriptionProfileType.ACCOMMODATION,
      status: SubscriptionStatus.ACTIVE,
      billingInterval: SubscriptionBillingInterval.ANNUAL,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(Date.now() + 86400_000),
      graceEndsAt: null,
      canceledAt: null,
      planVersion: 1,
      currentSnapshotId: 'snap-2',
      plan: {
        id: 'plan-ent',
        code: 'ACC_ENT',
        isFree: false,
        featureLimits: [
          {
            planVersion: 1,
            enabled: true,
            limitValue: 3,
            feature: {
              key: 'ACCOMMODATION_LISTINGS',
              isActive: true,
              valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
              applicableProfiles: [SubscriptionProfileType.ACCOMMODATION],
            },
          },
          {
            planVersion: 1,
            enabled: false,
            limitValue: null,
            feature: {
              key: 'ACCOMMODATION_ROOMS',
              isActive: true,
              valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
              applicableProfiles: [SubscriptionProfileType.ACCOMMODATION],
            },
          },
          {
            planVersion: 1,
            enabled: false,
            limitValue: null,
            feature: {
              key: 'AGENCY_CUSTOM_ROLES',
              isActive: true,
              valueType: SubscriptionFeatureValueType.BOOLEAN,
              applicableProfiles: [SubscriptionProfileType.ACCOMMODATION],
            },
          },
          {
            planVersion: 1,
            enabled: true,
            limitValue: 10,
            feature: {
              key: 'RETAIL_PRODUCTS',
              isActive: true,
              valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
              applicableProfiles: [SubscriptionProfileType.RETAIL],
            },
          },
        ],
      },
    });
    prisma.subscriptionEntitlementSnapshot.findFirst.mockResolvedValue({
      id: 'snap-2',
      version: 2,
    });
    prisma.organizationEntitlementOverride.findMany.mockResolvedValue([
      {
        enabled: true,
        limitValue: null,
        expiresAt: null,
        feature: {
          key: 'ACCOMMODATION_LISTINGS',
          isActive: true,
          valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
          applicableProfiles: [SubscriptionProfileType.ACCOMMODATION],
        },
      },
      {
        enabled: true,
        limitValue: null,
        expiresAt: null,
        feature: {
          key: 'AGENCY_CUSTOM_ROLES',
          isActive: true,
          valueType: SubscriptionFeatureValueType.BOOLEAN,
          applicableProfiles: [SubscriptionProfileType.ACCOMMODATION],
        },
      },
    ]);

    const res = await service.resolveForOrganization('org-ent');
    expect(res.entitlements.ACCOMMODATION_LISTINGS).toMatchObject({
      enabled: true,
      limitValue: null,
      unlimited: true,
      source: 'ORGANIZATION_OVERRIDE',
    });
    expect(res.entitlements.ACCOMMODATION_ROOMS).toMatchObject({
      enabled: false,
      unlimited: false,
      source: 'PLAN',
    });
    expect(res.entitlements.AGENCY_CUSTOM_ROLES).toMatchObject({
      enabled: true,
      limitValue: null,
      unlimited: false,
      source: 'ORGANIZATION_OVERRIDE',
    });
    // Profile isolation: RETAIL feature must not leak into ACCOMMODATION
    expect(res.entitlements.RETAIL_PRODUCTS).toBeUndefined();
  });

  it('rejects UNIVERSITY organizations with PROFILE_MISMATCH', async () => {
    const { prisma, service } = makeService();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-uni',
      type: OrgType.UNIVERSITY,
      status: OrgStatus.VERIFIED,
      businessCategory: BusinessCategory.RETAIL,
      deletedAt: null,
    });

    await expect(service.resolveForOrganization('org-uni')).rejects.toMatchObject({
      code: SubscriptionErrorCode.PROFILE_MISMATCH,
    });
  });

  it('throws NO_ACTIVE_SUBSCRIPTION when organization has no subscriptions', async () => {
    const { prisma, service } = makeService();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-none',
      type: OrgType.PROVIDER,
      status: OrgStatus.VERIFIED,
      businessCategory: BusinessCategory.RETAIL,
      deletedAt: null,
    });
    prisma.organizationSubscription.findFirst.mockResolvedValue(null);

    await expect(service.resolveForOrganization('org-none')).rejects.toMatchObject({
      code: SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
    });
  });

  it('retrieves historical snapshot at timestamp via effectiveFrom and version desc', async () => {
    const { prisma, snapshotService } = makeService();
    const targetDate = new Date('2026-11-20T00:00:00Z');
    prisma.subscriptionEntitlementSnapshot.findFirst.mockResolvedValue({
      id: 'snap-v1',
      version: 1,
    });

    const snap = await snapshotService.getSnapshotAtTimestamp(
      'sub-1',
      'org-1',
      targetDate,
    );
    expect(snap?.id).toBe('snap-v1');
    expect(prisma.subscriptionEntitlementSnapshot.findFirst).toHaveBeenCalledWith({
      where: {
        subscriptionId: 'sub-1',
        organizationId: 'org-1',
        effectiveFrom: { lte: targetDate },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    });
  });
});
