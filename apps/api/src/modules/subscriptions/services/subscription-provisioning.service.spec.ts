import {
  BusinessCategory,
  BusinessVerificationStatus,
  OrgStatus,
  OrgType,
  SubscriptionProfileType,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';
import { ProfileTypeResolverService } from './profile-type-resolver.service';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';
import { RequirementsEngineService } from '../../credentials/services/requirements-engine.service';

describe('SubscriptionProvisioningService (Unit)', () => {
  const makeMocks = () => {
    const tx = {
      organizationSubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'sub-1' }),
        update: jest.fn().mockResolvedValue({ id: 'sub-1' }),
      },
      subscriptionEntitlementSnapshot: {
        create: jest.fn().mockResolvedValue({ id: 'snap-1', version: 1 }),
      },
      subscriptionAuditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const prisma: any = {
      organization: { findUnique: jest.fn() },
      organizationSubscription: { findFirst: jest.fn() },
      subscriptionPlan: { findFirst: jest.fn() },
      subscriptionAuditEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };

    const service = new SubscriptionProvisioningService(
      prisma,
      new ProfileTypeResolverService(),
    );

    return { prisma, tx, service };
  };

  it('excludes UNIVERSITY organizations', async () => {
    const { prisma, service } = makeMocks();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-uni',
      type: OrgType.UNIVERSITY,
      status: OrgStatus.VERIFIED,
      businessCategory: BusinessCategory.RETAIL,
      deletedAt: null,
      profileCompletion: { overallStatus: BusinessVerificationStatus.VERIFIED },
    });

    const res = await service.provisionFreePlanForOrganization('org-uni');
    expect(res).toEqual({
      organizationId: 'org-uni',
      status: 'SKIPPED_INELIGIBLE',
      reason: 'EXCLUDED_UNIVERSITY',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('handles missing Free plan safely and writes audit records', async () => {
    const { prisma, service } = makeMocks();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-food',
      type: OrgType.RETAIL,
      status: OrgStatus.PENDING,
      businessCategory: BusinessCategory.FOOD,
      deletedAt: null,
      profileCompletion: { overallStatus: BusinessVerificationStatus.VERIFIED },
    });
    prisma.organizationSubscription.findFirst.mockResolvedValue(null);
    prisma.subscriptionPlan.findFirst.mockResolvedValue(null);

    const res = await service.provisionFreePlanForOrganization('org-food');
    expect(res).toEqual({
      organizationId: 'org-food',
      status: 'FAILED_MISSING_PLAN',
      profileType: SubscriptionProfileType.FOOD,
      reason: 'MISSING_FREE_PLAN_FOOD',
    });
    expect(prisma.subscriptionAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-food',
          action: 'PROVISIONING_FAILED_MISSING_FREE_PLAN',
        }),
      }),
    );
  });

  it.each([
    [SubscriptionStatus.ACTIVE, SubscriptionSource.ONLINE_CHECKOUT],
    [SubscriptionStatus.ACTIVE, SubscriptionSource.MANUAL_ADMIN],
    [SubscriptionStatus.ACTIVE, SubscriptionSource.ENTERPRISE_CONTRACT],
    [SubscriptionStatus.SUSPENDED, SubscriptionSource.ONLINE_CHECKOUT],
  ])(
    'preserves existing %s (%s) subscription without overwriting',
    async (status, source) => {
      const { prisma, service } = makeMocks();
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-existing',
        type: OrgType.PROVIDER,
        status: OrgStatus.VERIFIED,
        businessCategory: BusinessCategory.RETAIL,
        deletedAt: null,
        profileCompletion: {
          overallStatus: BusinessVerificationStatus.VERIFIED,
        },
      });
      prisma.organizationSubscription.findFirst.mockResolvedValue({
        id: 'sub-existing',
        status,
        source,
      });

      const res = await service.provisionFreePlanForOrganization('org-existing');
      expect(res.status).toBe('SKIPPED_EXISTING');
      expect(res.subscriptionId).toBe('sub-existing');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('creates ACTIVE FREE_AUTO subscription and initial snapshot v1', async () => {
    const { prisma, tx, service } = makeMocks();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-new',
      type: OrgType.PROVIDER,
      status: OrgStatus.PENDING,
      businessCategory: BusinessCategory.RETAIL,
      deletedAt: null,
      profileCompletion: { overallStatus: BusinessVerificationStatus.VERIFIED },
    });
    prisma.organizationSubscription.findFirst.mockResolvedValue(null);
    prisma.subscriptionPlan.findFirst.mockResolvedValue({
      id: 'plan-acc-free',
      code: 'ACCOMMODATION_FREE',
      name: 'Accommodation Free',
      profileType: SubscriptionProfileType.ACCOMMODATION,
      tier: 'FREE',
      planVersion: 1,
      isFree: true,
      featureLimits: [
        {
          planVersion: 1,
          enabled: true,
          limitValue: 3,
          feature: { key: 'ACCOMMODATION_LISTINGS' },
        },
      ],
    });

    const res = await service.provisionFreePlanForOrganization('org-new');
    expect(res).toEqual({
      organizationId: 'org-new',
      status: 'PROVISIONED',
      profileType: SubscriptionProfileType.ACCOMMODATION,
      subscriptionId: 'sub-1',
      planId: 'plan-acc-free',
      planCode: 'ACCOMMODATION_FREE',
    });
    expect(tx.subscriptionEntitlementSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 1,
          effectiveTo: null,
          previousSnapshotId: null,
          resolvedEntitlements: {
            ACCOMMODATION_LISTINGS: { enabled: true, limitValue: 3 },
          },
        }),
      }),
    );
  });

  it('deduplicates concurrent provisioning when Prisma throws P2002', async () => {
    const { prisma, service } = makeMocks();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-race',
      type: OrgType.RETAIL,
      status: OrgStatus.VERIFIED,
      businessCategory: BusinessCategory.MECHANICS,
      deletedAt: null,
      profileCompletion: { overallStatus: BusinessVerificationStatus.VERIFIED },
    });
    prisma.organizationSubscription.findFirst.mockResolvedValue(null);
    prisma.subscriptionPlan.findFirst.mockResolvedValue({
      id: 'plan-mech-free',
      code: 'MECHANICS_FREE',
      name: 'Mechanics Free',
      profileType: SubscriptionProfileType.MECHANICS,
      tier: 'FREE',
      planVersion: 1,
      isFree: true,
      featureLimits: [],
    });
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });

    const res = await service.provisionFreePlanForOrganization('org-race');
    expect(res).toEqual({
      organizationId: 'org-race',
      status: 'SKIPPED_EXISTING',
      reason: 'CONCURRENT_PROVISIONING_DEDUPLICATED',
    });
  });

  it('isolates provisioning failure from RequirementsEngineService verification', async () => {
    const mockPrisma: any = {
      businessProfileCompletion: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const mockProvisioning: any = {
      provisionFreePlanForOrganization: jest
        .fn()
        .mockRejectedValue(new Error('DB timeout')),
    };

    const engine = new RequirementsEngineService(mockPrisma, mockProvisioning);
    jest.spyOn(engine, 'resolveRequirementsForOrganization').mockResolvedValue({
      organizationId: 'org-ver',
      organizationName: 'Test Org',
      businessCategory: BusinessCategory.RETAIL,
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
        {
          isMandatory: true,
          currentStatus: 'VERIFIED',
        } as any,
      ],
    });

    const status = await engine.recalculateOrganizationVerificationStatus('org-ver');
    expect(status).toBe(BusinessVerificationStatus.VERIFIED);
    expect(mockProvisioning.provisionFreePlanForOrganization).toHaveBeenCalledWith(
      'org-ver',
      expect.any(Object),
    );
  });
});
