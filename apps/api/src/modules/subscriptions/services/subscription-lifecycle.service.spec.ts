import {
  SubscriptionBillingInterval,
  SubscriptionFeatureValueType,
  SubscriptionProfileType,
  SubscriptionSource,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import { OrgSubscriptionsController } from '../controllers/org-subscriptions.controller';
import { SubscriptionErrorCode } from '../errors/subscription-domain.error';
import { EnterpriseOverrideService } from './enterprise-override.service';
import { EntitlementSnapshotService } from './entitlement-snapshot.service';
import { ProfileTypeResolverService } from './profile-type-resolver.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionStatusService } from './subscription-status.service';

describe('SubscriptionStatusService & Lifecycle & Overrides (Unit)', () => {
  describe('7-Day Grace Period Boundary Semantics', () => {
    const statusService = new SubscriptionStatusService();

    it('treats now < graceEndsAt as active and now >= graceEndsAt as expired', () => {
      const periodEnd = new Date('2026-11-01T00:00:00.000Z');
      const graceEndsAt = statusService.computeGraceEndsAt(periodEnd);
      expect(graceEndsAt.toISOString()).toBe('2026-11-08T00:00:00.000Z');

      const justBefore = new Date('2026-11-07T23:59:59.999Z');
      const exactBoundary = new Date('2026-11-08T00:00:00.000Z');

      const activeGrace = statusService.evaluateAccess(
        {
          status: SubscriptionStatus.GRACE_PERIOD,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: periodEnd,
          graceEndsAt,
          canceledAt: null,
        },
        justBefore,
      );
      expect(activeGrace.isActive).toBe(true);
      expect(activeGrace.inGracePeriod).toBe(true);

      const expiredGrace = statusService.evaluateAccess(
        {
          status: SubscriptionStatus.GRACE_PERIOD,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: periodEnd,
          graceEndsAt,
          canceledAt: null,
        },
        exactBoundary,
      );
      expect(expiredGrace.isActive).toBe(false);
      expect(expiredGrace.effectiveStatus).toBe(SubscriptionStatus.EXPIRED);
    });

    it('never expires Free subscriptions with null currentPeriodEnd', () => {
      const res = statusService.evaluateAccess({
        status: SubscriptionStatus.ACTIVE,
        billingInterval: SubscriptionBillingInterval.FREE,
        isFreePlan: true,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        graceEndsAt: null,
        canceledAt: null,
      });
      expect(res.isActive).toBe(true);
      expect(res.effectiveStatus).toBe(SubscriptionStatus.ACTIVE);
    });
  });

  describe('SubscriptionLifecycleService validation', () => {
    const makeLifecycle = (subOverride: any) => {
      const tx: any = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        organizationSubscription: {
          findUnique: jest.fn().mockResolvedValue(subOverride),
          update: jest
            .fn()
            .mockImplementation(({ data }) => ({ ...subOverride, ...data })),
        },
        subscriptionAuditEvent: { create: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      const prisma: any = {
        $transaction: jest.fn((cb: any) => cb(tx)),
      };
      const statusService = new SubscriptionStatusService();
      const snapshotService = new EntitlementSnapshotService(prisma);
      jest
        .spyOn(snapshotService, 'createEntitlementSnapshot')
        .mockResolvedValue({ id: 'snap-new', version: 2 } as any);
      const lifecycle = new SubscriptionLifecycleService(
        prisma,
        statusService,
        snapshotService,
        new ProfileTypeResolverService(),
      );
      return { lifecycle, tx };
    };

    it('rejects expiring a Free subscription with null currentPeriodEnd', async () => {
      const { lifecycle } = makeLifecycle({
        id: 'sub-free',
        organizationId: 'org-1',
        status: SubscriptionStatus.ACTIVE,
        billingInterval: SubscriptionBillingInterval.FREE,
        currentPeriodEnd: null,
        plan: { isFree: true, isEnterprise: false },
      });

      await expect(
        lifecycle.expireSubscription('sub-free', 'org-1', { actorId: 'admin-1' }),
      ).rejects.toMatchObject({
        code: SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
      });
    });

    it('rejects invalid transition from EXPIRED to ACTIVE', async () => {
      const { lifecycle } = makeLifecycle({
        id: 'sub-exp',
        organizationId: 'org-1',
        status: SubscriptionStatus.EXPIRED,
        billingInterval: SubscriptionBillingInterval.MONTHLY,
        plan: { isFree: false, isEnterprise: false },
      });

      await expect(
        lifecycle.activateSubscription('sub-exp', 'org-1', {
          actorId: 'admin-1',
        }),
      ).rejects.toMatchObject({
        code: SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
      });
    });

    it('expires Enterprise contract without silently downgrading to Free', async () => {
      const { lifecycle, tx } = makeLifecycle({
        id: 'sub-ent',
        organizationId: 'org-1',
        status: SubscriptionStatus.GRACE_PERIOD,
        billingInterval: SubscriptionBillingInterval.CUSTOM,
        source: SubscriptionSource.ENTERPRISE_CONTRACT,
        graceEndsAt: new Date('2026-11-01T00:00:00Z'),
        plan: { isFree: false, isEnterprise: true },
      });

      const updated = await lifecycle.expireSubscription(
        'sub-ent',
        'org-1',
        { actorId: 'system' },
        { now: new Date('2026-11-02T00:00:00Z') },
      );
      expect(updated.status).toBe(SubscriptionStatus.EXPIRED);
      expect(tx.subscriptionAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            afterState: expect.objectContaining({ isEnterprise: true }),
          }),
        }),
      );
    });
  });

  describe('EnterpriseOverrideService validation', () => {
    it('rejects cross-organization override mutations and negative limits', async () => {
      const tx: any = {
        organizationSubscription: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sub-other',
            organizationId: 'org-A',
            profileType: SubscriptionProfileType.RETAIL,
            status: SubscriptionStatus.ACTIVE,
          }),
        },
        subscriptionFeature: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'feat-1',
            key: 'RETAIL_PRODUCTS',
            isActive: true,
            valueType: SubscriptionFeatureValueType.NUMERIC_LIMIT,
            applicableProfiles: [SubscriptionProfileType.RETAIL],
          }),
        },
      };
      const prisma: any = {
        $transaction: jest.fn((cb: any) => cb(tx)),
      };
      const service = new EnterpriseOverrideService(
        prisma,
        new EntitlementSnapshotService(prisma),
      );

      await expect(
        service.upsertOverride({
          organizationId: 'org-B',
          subscriptionId: 'sub-other',
          featureKey: 'RETAIL_PRODUCTS',
          enabled: true,
          limitValue: 50,
          reason: 'Cross-org test',
          actorId: 'admin-1',
        }),
      ).rejects.toMatchObject({
        code: SubscriptionErrorCode.CROSS_ORGANIZATION_ACCESS_DENIED,
      });

      await expect(
        service.upsertOverride({
          organizationId: 'org-A',
          subscriptionId: 'sub-other',
          featureKey: 'RETAIL_PRODUCTS',
          enabled: true,
          limitValue: -5,
          reason: 'Negative limit test',
          actorId: 'admin-1',
        }),
      ).rejects.toMatchObject({
        code: SubscriptionErrorCode.INVALID_ENTITLEMENT_OVERRIDE,
      });
    });
  });

  describe('OrgSubscriptionsController', () => {
    it('returns SUBSCRIPTIONS_DISABLED when SUBSCRIPTIONS_ENABLED is false', async () => {
      const resolver: any = { getCurrentSubscriptionSummary: jest.fn() };
      const flags: any = { isEnabled: jest.fn().mockResolvedValue(false) };
      const controller = new OrgSubscriptionsController(resolver, flags);

      await expect(
        controller.getCurrentSubscription({
          user: { role: UserRole.ORG_STAFF, organizationId: 'org-1' },
        }),
      ).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTIONS_DISABLED,
      });
    });

    it('excludes STUDENT and ADMIN roles when enabled', async () => {
      const resolver: any = { getCurrentSubscriptionSummary: jest.fn() };
      const flags: any = { isEnabled: jest.fn().mockResolvedValue(true) };
      const controller = new OrgSubscriptionsController(resolver, flags);

      await expect(
        controller.getCurrentEntitlements({
          user: { role: UserRole.STUDENT },
        }),
      ).rejects.toMatchObject({
        code: SubscriptionErrorCode.PROFILE_MISMATCH,
      });
    });
  });
});
