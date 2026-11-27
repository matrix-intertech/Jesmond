import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  SubscriptionBillingInterval,
  SubscriptionPaymentStatus,
  SubscriptionSource,
  SubscriptionStatus,
  SubscriptionWebhookStatus,
  UserRole,
} from '@prisma/client';
import { AdminFeaturesController } from '../admin/admin-features.controller';
import { AppointmentsService } from '../appointments/services/appointments.service';
import { BranchesService } from '../retail/branches/branches.service';
import { CatalogService } from '../retail/catalog/catalog.service';
import { AdminSubscriptionPermission } from './auth/admin-subscription-permissions';
import { PublicPricingController } from './controllers/public-pricing.controller';
import { SubscriptionGuard } from './guards/subscription.guard';
import { AdminSubscriptionsService } from './services/admin-subscriptions.service';
import { SubscriptionBillingService } from './services/subscription-billing.service';

describe('Phase 5.1 — Final Subscription Release Hardening', () => {
  describe('1. AdminFeaturesController subscription switch authorization', () => {
    const makeController = (dbPermissions: string[] = []) => {
      const featureFlagService = {
        setFeatureState: jest.fn(async (key: string, enabled: boolean) => ({
          key,
          enabled,
        })),
      } as any;
      const prisma = {
        user: {
          findUnique: jest.fn(async () => ({ permissions: dbPermissions })),
        },
      } as any;
      return {
        controller: new AdminFeaturesController(featureFlagService, prisma),
        featureFlagService,
      };
    };

    it.each([
      'SUBSCRIPTIONS_ENABLED',
      'SUBSCRIPTION_ENFORCEMENT_ENABLED',
      'SUBSCRIPTION_CHECKOUT_ENABLED',
    ])('rejects ADMIN without SUBSCRIPTION_SWITCHES_MANAGE for %s', async (key) => {
      const { controller, featureFlagService } = makeController([
        AdminSubscriptionPermission.SUBSCRIPTION_BILLING_VIEW,
      ]);
      await expect(
        controller.updateFeatureState(
          key,
          { enabled: true },
          { user: { id: 'admin-1', role: UserRole.ADMIN, permissions: [] } },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(featureFlagService.setFeatureState).not.toHaveBeenCalled();
    });

    it('allows ADMIN with SUBSCRIPTION_SWITCHES_MANAGE and SUPER_ADMIN', async () => {
      const { controller, featureFlagService } = makeController([
        AdminSubscriptionPermission.SUBSCRIPTION_SWITCHES_MANAGE,
      ]);
      await expect(
        controller.updateFeatureState(
          'SUBSCRIPTIONS_ENABLED',
          { enabled: true },
          { user: { id: 'admin-1', role: UserRole.ADMIN, permissions: [] } },
        ),
      ).resolves.toEqual({ key: 'SUBSCRIPTIONS_ENABLED', enabled: true });

      await expect(
        controller.updateFeatureState(
          'SUBSCRIPTION_CHECKOUT_ENABLED',
          { enabled: true },
          { user: { id: 'sa-1', role: UserRole.SUPER_ADMIN } },
        ),
      ).resolves.toEqual({ key: 'SUBSCRIPTION_CHECKOUT_ENABLED', enabled: true });
      expect(featureFlagService.setFeatureState).toHaveBeenCalledTimes(2);
    });

    it('preserves ADMIN access for unrelated feature flags without SUBSCRIPTION_SWITCHES_MANAGE', async () => {
      const { controller } = makeController([]);
      await expect(
        controller.updateFeatureState(
          'PAYMENTS_BOOKING',
          { enabled: false },
          { user: { id: 'admin-1', role: UserRole.ADMIN, permissions: [] } },
        ),
      ).resolves.toEqual({ key: 'PAYMENTS_BOOKING', enabled: false });
    });
  });

  describe('2. Stripe cancellation synchronization', () => {
    it('syncs immediate & period-end cancellation for ONLINE_CHECKOUT and aborts local cancel on Stripe failure', async () => {
      const sub = {
        id: 'sub-1',
        organizationId: 'org-1',
        source: SubscriptionSource.ONLINE_CHECKOUT,
        status: SubscriptionStatus.ACTIVE,
        externalSubscriptionId: 'sub_stripe_123',
        cancelAtPeriodEnd: false,
      };
      const prisma = {
        organizationSubscription: {
          findUnique: jest.fn(async () => ({ ...sub })),
        },
      } as any;
      const lifecycleService = {
        cancelImmediately: jest.fn(async () => ({
          ...sub,
          status: SubscriptionStatus.CANCELED,
        })),
        scheduleCancellationAtPeriodEnd: jest.fn(async () => ({
          ...sub,
          cancelAtPeriodEnd: true,
        })),
      } as any;
      const stripeAdapter = {
        cancelExternalSubscription: jest.fn(async () => {}),
      } as any;

      const service = new AdminSubscriptionsService(
        prisma,
        lifecycleService,
        {} as any,
        {} as any,
        stripeAdapter,
      );

      // Stripe failure prevents local cancellation
      stripeAdapter.cancelExternalSubscription.mockRejectedValueOnce(
        new ServiceUnavailableException('Stripe API down'),
      );
      await expect(
        service.cancelOrganizationSubscription('org-1', 'sub-1', 'Test', 'adm-1', true),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(lifecycleService.cancelImmediately).not.toHaveBeenCalled();

      // Retry succeeds
      await service.cancelOrganizationSubscription('org-1', 'sub-1', 'Test', 'adm-1', true);
      expect(stripeAdapter.cancelExternalSubscription).toHaveBeenCalledWith(
        'sub_stripe_123',
        true,
      );
      expect(lifecycleService.cancelImmediately).toHaveBeenCalledTimes(1);

      // Period-end cancel
      await service.cancelOrganizationSubscription('org-1', 'sub-1', 'Test', 'adm-1', false);
      expect(stripeAdapter.cancelExternalSubscription).toHaveBeenCalledWith(
        'sub_stripe_123',
        false,
      );
      expect(lifecycleService.scheduleCancellationAtPeriodEnd).toHaveBeenCalledTimes(1);
    });

    it('handles missing externalSubscriptionId safely, is idempotent on CANCELED, and skips Stripe for ENTERPRISE_CONTRACT', async () => {
      const prisma = {
        organizationSubscription: {
          findUnique: jest.fn(),
        },
      } as any;
      const lifecycleService = {
        cancelImmediately: jest.fn(async (_id, _org, actor) => ({
          status: SubscriptionStatus.CANCELED,
          reason: actor.reason,
        })),
      } as any;
      const stripeAdapter = {
        cancelExternalSubscription: jest.fn(),
      } as any;
      const service = new AdminSubscriptionsService(
        prisma,
        lifecycleService,
        {} as any,
        {} as any,
        stripeAdapter,
      );

      // Missing externalSubscriptionId
      prisma.organizationSubscription.findUnique.mockResolvedValueOnce({
        id: 'sub-missing',
        organizationId: 'org-1',
        source: SubscriptionSource.ONLINE_CHECKOUT,
        status: SubscriptionStatus.ACTIVE,
        externalSubscriptionId: null,
        cancelAtPeriodEnd: false,
      });
      await service.cancelOrganizationSubscription('org-1', 'sub-missing', 'Manual', 'adm-1', true);
      expect(stripeAdapter.cancelExternalSubscription).not.toHaveBeenCalled();
      expect(lifecycleService.cancelImmediately).toHaveBeenCalledTimes(1);

      // Idempotent retry when already CANCELED
      prisma.organizationSubscription.findUnique.mockResolvedValueOnce({
        id: 'sub-done',
        organizationId: 'org-1',
        source: SubscriptionSource.ONLINE_CHECKOUT,
        status: SubscriptionStatus.CANCELED,
        externalSubscriptionId: 'sub_123',
      });
      const retryRes = await service.cancelOrganizationSubscription('org-1', 'sub-done', 'Retry', 'adm-1', true);
      expect(retryRes.status).toBe(SubscriptionStatus.CANCELED);
      expect(stripeAdapter.cancelExternalSubscription).not.toHaveBeenCalled();

      // Enterprise contract preserves manual cancel
      prisma.organizationSubscription.findUnique.mockResolvedValueOnce({
        id: 'sub-ent',
        organizationId: 'org-1',
        source: SubscriptionSource.ENTERPRISE_CONTRACT,
        status: SubscriptionStatus.ACTIVE,
        externalSubscriptionId: null,
      });
      await service.cancelOrganizationSubscription('org-1', 'sub-ent', 'Contract end', 'adm-1', true);
      expect(stripeAdapter.cancelExternalSubscription).not.toHaveBeenCalled();
      expect(lifecycleService.cancelImmediately).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. Billing transaction matching, period idempotency & refund bounds', () => {
    it('updates PENDING transaction in-place and prevents duplicate billing periods on checkout + initial invoice.paid', async () => {
      const periods: any[] = [];
      const transactions: any[] = [
        {
          id: 'tx-pending-1',
          organizationId: 'org-1',
          subscriptionId: 'sub-old',
          status: SubscriptionPaymentStatus.PENDING,
          amountMinor: 4900,
          currency: 'AUD',
          metadata: { checkoutSessionId: 'cs_test_1' },
        },
      ];
      const webhookEvents = new Map<string, any>();

      const prisma = {
        subscriptionWebhookEvent: {
          findUnique: jest.fn(async ({ where }: any) =>
            webhookEvents.get(where.provider_externalEventId.externalEventId) ?? null,
          ),
          create: jest.fn(async ({ data }: any) => {
            const row = { id: `we-${data.externalEventId}`, ...data };
            webhookEvents.set(data.externalEventId, row);
            return row;
          }),
          update: jest.fn(async ({ where, data }: any) => {
            for (const [k, v] of webhookEvents.entries()) {
              if (v.id === where.id) webhookEvents.set(k, { ...v, ...data });
            }
          }),
        },
        subscriptionPlanPrice: {
          findUnique: jest.fn(async () => ({
            id: 'pp-1',
            unitAmountMinor: 4900,
            currency: 'AUD',
          })),
        },
        organizationSubscription: {
          findFirst: jest.fn(async ({ where }: any) => {
            if (where.externalSubscriptionId === 'sub_stripe_1') {
              return {
                id: 'sub-new',
                organizationId: 'org-1',
                planPriceId: 'pp-1',
                billingInterval: SubscriptionBillingInterval.MONTHLY,
                status: SubscriptionStatus.ACTIVE,
                currentPeriodStart: new Date(1700000000 * 1000),
              };
            }
            return null;
          }),
          update: jest.fn(async () => ({})),
        },
        subscriptionBillingPeriod: {
          findFirst: jest.fn(async ({ where }: any) =>
            periods.find(
              (p) =>
                p.subscriptionId === where.subscriptionId &&
                p.periodStart >= where.periodStart.gte &&
                p.periodStart <= where.periodStart.lte,
            ) ?? null,
          ),
          create: jest.fn(async ({ data }: any) => {
            const p = { id: `bp-${periods.length + 1}`, ...data };
            periods.push(p);
            return p;
          }),
        },
        subscriptionPaymentTransaction: {
          findFirst: jest.fn(async ({ where }: any) =>
            transactions.find(
              (t) =>
                t.organizationId === where.organizationId &&
                t.status === where.status &&
                t.metadata?.checkoutSessionId === where.metadata?.equals,
            ) ?? null,
          ),
          update: jest.fn(async ({ where, data }: any) => {
            const idx = transactions.findIndex((t) => t.id === where.id);
            transactions[idx] = { ...transactions[idx], ...data };
            return transactions[idx];
          }),
          upsert: jest.fn(async ({ where, create, update }: any) => {
            const existing = transactions.find(
              (t) => t.externalPaymentId === where.externalPaymentId,
            );
            if (existing) {
              Object.assign(existing, update);
              return existing;
            }
            const created = { id: `tx-${transactions.length + 1}`, ...create };
            transactions.push(created);
            return created;
          }),
        },
      } as any;

      const featureFlagService = {
        isEnabled: jest.fn(async () => true),
      } as any;
      const stripeAdapter = {
        verifyAndParseWebhook: jest.fn((rawBody: Buffer) =>
          JSON.parse(rawBody.toString('utf8')),
        ),
      } as any;
      const lifecycleService = {
        replaceSubscription: jest.fn(async () => ({
          subscription: { id: 'sub-new' },
        })),
        renewSubscription: jest.fn(async () => ({})),
      } as any;

      const service = new SubscriptionBillingService(
        prisma,
        featureFlagService,
        stripeAdapter,
        {} as any,
        lifecycleService,
      );

      // 1. checkout.session.completed
      await service.processStripeWebhook(
        Buffer.from(
          JSON.stringify({
            id: 'evt_checkout_1',
            type: 'checkout.session.completed',
            created: 1700000000,
            dataObject: {
              id: 'cs_test_1',
              customer: 'cus_1',
              subscription: 'sub_stripe_1',
              payment_intent: 'pi_1',
              amount_total: 4900,
              currency: 'aud',
              metadata: {
                organizationId: 'org-1',
                planId: 'plan-1',
                planPriceId: 'pp-1',
                interval: 'MONTHLY',
              },
            },
          }),
        ),
        'sig',
      );

      expect(transactions).toHaveLength(1);
      expect(transactions[0].status).toBe(SubscriptionPaymentStatus.SUCCEEDED);
      expect(transactions[0].externalPaymentId).toBe('pi_1');
      expect(periods).toHaveLength(1);

      // 2. Initial invoice.paid for same period -> reuses existing billing period (no duplicate)
      await service.processStripeWebhook(
        Buffer.from(
          JSON.stringify({
            id: 'evt_inv_1',
            type: 'invoice.paid',
            created: 1700000010,
            dataObject: {
              id: 'in_1',
              subscription: 'sub_stripe_1',
              payment_intent: 'pi_1',
              amount_paid: 4900,
              currency: 'aud',
              period_start: 1700000000,
              period_end: 1702592000,
            },
          }),
        ),
        'sig',
      );
      expect(periods).toHaveLength(1);

      // 3. Duplicate webhook delivery is deduplicated
      const dup = await service.processStripeWebhook(
        Buffer.from(
          JSON.stringify({
            id: 'evt_inv_1',
            type: 'invoice.paid',
            created: 1700000010,
            dataObject: {},
          }),
        ),
        'sig',
      );
      expect(dup.deduplicated).toBe(true);

      // 4. Out-of-order stale invoice event is ignored
      const stale = await service.processStripeWebhook(
        Buffer.from(
          JSON.stringify({
            id: 'evt_inv_stale',
            type: 'invoice.paid',
            created: 1690000000,
            dataObject: {
              id: 'in_old',
              subscription: 'sub_stripe_1',
            },
          }),
        ),
        'sig',
      );
      expect(stale.ignored).toBe(true);
    });

    it('validates refund bounds and cumulative partial refunds', async () => {
      let txState: any = {
        id: 'tx-1',
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        externalPaymentId: 'pi_1',
        amountMinor: 5000,
        status: SubscriptionPaymentStatus.SUCCEEDED,
        metadata: {},
      };
      const prisma = {
        subscriptionPaymentTransaction: {
          findUnique: jest.fn(async () => ({ ...txState })),
          update: jest.fn(async ({ data }: any) => {
            txState = { ...txState, ...data };
            return txState;
          }),
        },
        subscriptionAuditEvent: {
          create: jest.fn(async () => ({})),
        },
      } as any;
      const stripeAdapter = {
        refundPayment: jest.fn(async () => ({
          refundId: 're_1',
          status: 'succeeded',
        })),
      } as any;
      const service = new SubscriptionBillingService(
        prisma,
        {} as any,
        stripeAdapter,
        {} as any,
        {} as any,
      );

      await expect(
        service.refundTransaction('tx-1', 'Bad', 'adm-1', 0),
      ).rejects.toThrow();
      await expect(
        service.refundTransaction('tx-1', 'Too high', 'adm-1', 5001),
      ).rejects.toThrow();

      // Partial refund 3000
      const p1 = await service.refundTransaction('tx-1', 'Partial 1', 'adm-1', 3000);
      expect(p1.status).toBe(SubscriptionPaymentStatus.PARTIALLY_REFUNDED);

      // Exceeding remaining 2000 rejected
      await expect(
        service.refundTransaction('tx-1', 'Too much', 'adm-1', 2500),
      ).rejects.toThrow(/Cumulative refund exceeds/);

      // Remaining 2000 succeeds -> REFUNDED
      const p2 = await service.refundTransaction('tx-1', 'Partial 2', 'adm-1', 2000);
      expect(p2.status).toBe(SubscriptionPaymentStatus.REFUNDED);
    });
  });

  describe('4. SubscriptionGuard missing-user fail-closed & switch-OFF behaviour', () => {
    it('fails closed when req.user is missing and enforcement is ON, while keeping switch-OFF open for authenticated users', async () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'subscription_feature') return { featureKey: 'RETAIL_BRANCHES' };
        return undefined;
      });
      const featureFlagService = {
        isEnabled: jest.fn(async () => true),
      } as any;
      const guard = new SubscriptionGuard(reflector, featureFlagService);
      const ctx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
      } as any;

      await expect(guard.canActivate(ctx)).resolves.toBe(false);

      featureFlagService.isEnabled.mockResolvedValue(false);
      const authedCtx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'u1', role: UserRole.ORG_STAFF } }),
        }),
      } as any;
      await expect(guard.canActivate(authedCtx)).resolves.toBe(true);
    });
  });

  describe('5. Quota active/inactive transitions & row locking', () => {
    it('adjusts RETAIL_BRANCHES on updateBranch isActive transitions and locks row in deleteBranch', async () => {
      let dbBranchActive = true;
      const usageCounterService = {
        enforceAndIncrementInTransaction: jest.fn(async () => {}),
        decrementCounterInTransaction: jest.fn(async () => {}),
      } as any;
      const tx = {
        $queryRaw: jest.fn(async () => [{ isActive: dbBranchActive }]),
        retailBranch: {
          update: jest.fn(async ({ data }: any) => {
            dbBranchActive = data.isActive ?? dbBranchActive;
            return { id: 'br-1', isActive: dbBranchActive };
          }),
        },
      };
      const prisma = {
        retailBranch: {
          findUnique: jest.fn(async () => ({ id: 'br-1', organizationId: 'org-1', isActive: true })),
        },
        $transaction: jest.fn(async (cb: any) => cb(tx)),
      } as any;
      const redis = { delByPattern: jest.fn(async () => {}) } as any;
      const service = new BranchesService(prisma, redis, usageCounterService);

      // Deactivate via updateBranch
      await service.updateBranch('org-1', 'br-1', { isActive: false });
      expect(usageCounterService.decrementCounterInTransaction).toHaveBeenCalledTimes(1);

      // Concurrent/repeated deleteBranch sees locked dbBranchActive=false -> no double decrement
      await service.deleteBranch('org-1', 'br-1');
      expect(usageCounterService.decrementCounterInTransaction).toHaveBeenCalledTimes(1);

      // Reactivate via updateBranch
      await service.updateBranch('org-1', 'br-1', { isActive: true });
      expect(usageCounterService.enforceAndIncrementInTransaction).toHaveBeenCalledTimes(1);
    });

    it('adjusts APPOINTMENT_SERVICES on updateBusinessService isActive transitions and locks row in deleteBusinessService', async () => {
      let dbService = { isActive: true, deletedAt: null as Date | null };
      const usageCounterService = {
        enforceAndIncrementInTransaction: jest.fn(async () => {}),
        decrementCounterInTransaction: jest.fn(async () => {}),
      } as any;
      const tx = {
        $queryRaw: jest.fn(async () => [{ ...dbService }]),
        businessService: {
          update: jest.fn(async ({ data }: any) => {
            if (data.isActive !== undefined) dbService.isActive = data.isActive;
            if (data.deletedAt !== undefined) dbService.deletedAt = data.deletedAt;
            return { id: 'svc-1', ...dbService };
          }),
          findUnique: jest.fn(async () => ({ id: 'svc-1', ...dbService })),
        },
      };
      const prisma = {
        businessService: {
          findUnique: jest.fn(async () => ({
            id: 'svc-1',
            organizationId: 'org-1',
            isActive: true,
            deletedAt: null,
          })),
        },
        $transaction: jest.fn(async (cb: any) => cb(tx)),
      } as any;
      const service = new AppointmentsService(
        prisma,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        usageCounterService,
      );

      await service.updateBusinessService('org-1', 'svc-1', { isActive: false });
      expect(usageCounterService.decrementCounterInTransaction).toHaveBeenCalledTimes(1);

      await service.updateBusinessService('org-1', 'svc-1', { isActive: true });
      expect(usageCounterService.enforceAndIncrementInTransaction).toHaveBeenCalledTimes(1);

      // Concurrent second delete sees locked deletedAt != null -> no double decrement
      await service.deleteBusinessService('org-1', 'svc-1');
      await service.deleteBusinessService('org-1', 'svc-1');
      expect(usageCounterService.decrementCounterInTransaction).toHaveBeenCalledTimes(2);
    });

    it('uses FOR UPDATE inside CatalogService.updateProduct to prevent concurrent double decrement', async () => {
      let dbActive = true;
      const usageCounterService = {
        enforceAndIncrementInTransaction: jest.fn(async () => {}),
        decrementCounterInTransaction: jest.fn(async () => {}),
      } as any;
      const tx = {
        $queryRaw: jest.fn(async () => [{ isActive: dbActive }]),
        product: {
          update: jest.fn(async ({ data }: any) => {
            dbActive = data.isActive;
            return { id: 'prod-1', isActive: dbActive };
          }),
        },
        auditLog: { create: jest.fn(async () => ({})) },
      };
      const prisma = {
        product: {
          findUnique: jest.fn(async () => ({
            id: 'prod-1',
            organizationId: 'org-1',
            isActive: true,
            sku: 'S1',
            barcode: null,
            name: 'P1',
            sellingPrice: 10,
            imageUrl: 'https://img.example.com/1.png',
          })),
        },
        $transaction: jest.fn(async (cb: any) => cb(tx)),
      } as any;
      const service = new CatalogService(
        prisma,
        usageCounterService,
      );

      await service.updateProduct('org-1', 'u-1', 'prod-1', { isActive: false });
      await service.updateProduct('org-1', 'u-1', 'prod-1', { isActive: false });
      expect(usageCounterService.decrementCounterInTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('6. PublicPricingController checkout readiness', () => {
    it('reports checkoutEnabled=false when Stripe readiness or purchasable plans are missing', async () => {
      const prisma = {
        subscriptionPlan: {
          count: jest.fn(async () => 0),
          findMany: jest.fn(async () => []),
        },
      } as any;
      const featureFlagService = {
        isEnabled: jest.fn(async () => true),
      } as any;
      const billingService = {
        getBillingReadiness: jest.fn(async () => ({ checkoutReady: false })),
      } as any;

      const controller = new PublicPricingController(
        prisma,
        featureFlagService,
        billingService,
      );

      expect(await controller.getPublicConfig()).toEqual({
        subscriptionsEnabled: true,
        checkoutEnabled: false,
      });

      billingService.getBillingReadiness.mockResolvedValueOnce({ checkoutReady: true });
      prisma.subscriptionPlan.count.mockResolvedValueOnce(1);
      expect(await controller.getPublicConfig()).toEqual({
        subscriptionsEnabled: true,
        checkoutEnabled: true,
      });
    });
  });
});
