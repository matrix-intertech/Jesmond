import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  BusinessCategory,
  BusinessVerificationStatus,
  OrgType,
  PrismaClient,
  SubscriptionBillingInterval,
  SubscriptionPaymentStatus,
  SubscriptionPlanTier,
  SubscriptionProfileType,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';
import { FeatureFlagService } from '../admin/feature-flag.service';
import { StripeSubscriptionAdapter } from './payments/stripe-subscription.adapter';
import { EntitlementSnapshotService } from './services/entitlement-snapshot.service';
import { ProfileTypeResolverService } from './services/profile-type-resolver.service';
import {
  EXISTING_STRIPE_SWITCH_KEY,
  SubscriptionBillingService,
} from './services/subscription-billing.service';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { SubscriptionProvisioningService } from './services/subscription-provisioning.service';
import { SubscriptionStatusService } from './services/subscription-status.service';

describe('Subscriptions Phase 5 — Mocked Stripe Billing & Webhooks', () => {
  let prisma: PrismaClient;
  let lifecycleService: SubscriptionLifecycleService;
  let profileResolver: ProfileTypeResolverService;
  let provisioning: SubscriptionProvisioningService;
  const createdOrgIds: string[] = [];
  const createdPlanIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    profileResolver = new ProfileTypeResolverService();
    const statusService = new SubscriptionStatusService();
    const snapshotService = new EntitlementSnapshotService(prisma as any);
    lifecycleService = new SubscriptionLifecycleService(
      prisma as any,
      statusService,
      snapshotService,
      profileResolver,
    );
    provisioning = new SubscriptionProvisioningService(
      prisma as any,
      profileResolver,
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
    await prisma.subscriptionWebhookEvent.deleteMany({
      where: { externalEventId: { startsWith: 'evt_test_p5_' } },
    });
    await prisma.$disconnect();
  });

  const makeMockFlags = (overrides: Record<string, boolean>) =>
    ({
      isEnabled: jest.fn(async (key: string) => overrides[key] ?? false),
    }) as unknown as FeatureFlagService;

  const makeMockAdapter = (opts?: {
    configured?: boolean;
    webhookConfigured?: boolean;
    verifyImpl?: (rawBody: Buffer, sig: string) => any;
  }) =>
    ({
      providerName: 'STRIPE',
      isConfigured: jest.fn(() => opts?.configured ?? true),
      isWebhookConfigured: jest.fn(() => opts?.webhookConfigured ?? true),
      createCheckoutSession: jest.fn().mockResolvedValue({
        sessionId: 'cs_test_123',
        checkoutUrl: 'https://checkout.stripe.test/session/cs_test_123',
      }),
      verifyAndParseWebhook: jest.fn(
        opts?.verifyImpl ??
          (() => {
            throw new BadRequestException('Invalid Stripe webhook signature');
          }),
      ),
      cancelExternalSubscription: jest.fn().mockResolvedValue(undefined),
      refundPayment: jest.fn().mockResolvedValue({
        refundId: 're_test_123',
        status: 'succeeded',
      }),
    }) as unknown as StripeSubscriptionAdapter;

  it('verifies all four switches remain OFF in the local database', async () => {
    const realFlags = new FeatureFlagService(prisma as any);
    expect(await realFlags.isEnabled('SUBSCRIPTIONS_ENABLED')).toBe(false);
    expect(await realFlags.isEnabled('SUBSCRIPTION_ENFORCEMENT_ENABLED')).toBe(
      false,
    );
    expect(await realFlags.isEnabled('SUBSCRIPTION_CHECKOUT_ENABLED')).toBe(
      false,
    );
    expect(await realFlags.isEnabled(EXISTING_STRIPE_SWITCH_KEY)).toBe(false);
  });

  it('blocks checkout when any eligibility gate fails (subscriptions OFF, checkout OFF, PAYMENTS_BOOKING OFF, missing key)', async () => {
    const adapter = makeMockAdapter({ configured: true });

    const s1 = new SubscriptionBillingService(
      prisma as any,
      makeMockFlags({
        SUBSCRIPTIONS_ENABLED: false,
        SUBSCRIPTION_CHECKOUT_ENABLED: false,
        [EXISTING_STRIPE_SWITCH_KEY]: false,
      }),
      adapter,
      profileResolver,
      lifecycleService,
    );
    await expect(s1.assertCheckoutEligible()).rejects.toThrow();

    const s2 = new SubscriptionBillingService(
      prisma as any,
      makeMockFlags({
        SUBSCRIPTIONS_ENABLED: true,
        SUBSCRIPTION_CHECKOUT_ENABLED: false,
        [EXISTING_STRIPE_SWITCH_KEY]: true,
      }),
      adapter,
      profileResolver,
      lifecycleService,
    );
    await expect(s2.assertCheckoutEligible()).rejects.toThrow(
      ServiceUnavailableException,
    );

    const s3 = new SubscriptionBillingService(
      prisma as any,
      makeMockFlags({
        SUBSCRIPTIONS_ENABLED: true,
        SUBSCRIPTION_CHECKOUT_ENABLED: true,
        [EXISTING_STRIPE_SWITCH_KEY]: false,
      }),
      adapter,
      profileResolver,
      lifecycleService,
    );
    await expect(s3.assertCheckoutEligible()).rejects.toThrow(
      ServiceUnavailableException,
    );

    const noKeyAdapter = makeMockAdapter({ configured: false });
    const s4 = new SubscriptionBillingService(
      prisma as any,
      makeMockFlags({
        SUBSCRIPTIONS_ENABLED: true,
        SUBSCRIPTION_CHECKOUT_ENABLED: true,
        [EXISTING_STRIPE_SWITCH_KEY]: true,
      }),
      noKeyAdapter,
      profileResolver,
      lifecycleService,
    );
    await expect(s4.assertCheckoutEligible()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects webhook when webhook secret is missing or signature is invalid', async () => {
    const prevSubSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;
    const prevWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const realAdapter = new StripeSubscriptionAdapter({
      getClient: () => ({ webhooks: { constructEvent: jest.fn() } }),
    } as any);
    expect(realAdapter.isWebhookConfigured()).toBe(false);
    expect(() =>
      realAdapter.verifyAndParseWebhook(Buffer.from('{}'), 'sig_123'),
    ).toThrow(ServiceUnavailableException);

    process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET = 'whsec_test_only';
    const invalidSigAdapter = new StripeSubscriptionAdapter({
      getClient: () => ({
        webhooks: {
          constructEvent: () => {
            throw new Error('Signature mismatch');
          },
        },
      }),
    } as any);
    expect(() =>
      invalidSigAdapter.verifyAndParseWebhook(Buffer.from('{}'), 'bad_sig'),
    ).toThrow(BadRequestException);

    if (prevSubSecret !== undefined)
      process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET = prevSubSecret;
    else delete process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;
    if (prevWebhookSecret !== undefined)
      process.env.STRIPE_WEBHOOK_SECRET = prevWebhookSecret;
    else delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it('rejects Free and Enterprise plans from Stripe checkout while allowing Free/Enterprise without Stripe', async () => {
    const org = await prisma.organization.create({
      data: {
        name: 'Phase 5 Free & Enterprise Org',
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

    // Free provisioning works with Stripe completely OFF
    const freeRes = await provisioning.provisionFreePlanForOrganization(org.id);
    expect(freeRes.status).toBe('PROVISIONED');

    const entPlan = await prisma.subscriptionPlan.create({
      data: {
        profileType: SubscriptionProfileType.RETAIL,
        code: `RET_ENT_P5_${Date.now()}`,
        name: 'Retail Enterprise P5',
        tier: SubscriptionPlanTier.ENTERPRISE,
        isFree: false,
        isEnterprise: true,
        prices: {
          create: {
            interval: SubscriptionBillingInterval.ANNUAL,
            unitAmountMinor: 500000,
            currency: 'AUD',
            isActive: true,
          },
        },
      },
      include: { prices: true },
    });
    createdPlanIds.push(entPlan.id);

    // Manual Enterprise assignment works without Stripe
    const assigned = await lifecycleService.replaceSubscription({
      organizationId: org.id,
      newPlanId: entPlan.id,
      billingInterval: SubscriptionBillingInterval.CUSTOM,
      source: SubscriptionSource.ENTERPRISE_CONTRACT,
      actor: { actorId: 'super-admin', reason: 'Enterprise contract' },
    });
    expect(assigned.subscription.source).toBe(
      SubscriptionSource.ENTERPRISE_CONTRACT,
    );

    // Self-serve checkout rejects Free & Enterprise plans
    const billing = new SubscriptionBillingService(
      prisma as any,
      makeMockFlags({
        SUBSCRIPTIONS_ENABLED: true,
        SUBSCRIPTION_CHECKOUT_ENABLED: true,
        [EXISTING_STRIPE_SWITCH_KEY]: true,
      }),
      makeMockAdapter(),
      profileResolver,
      lifecycleService,
    );

    await expect(
      billing.createCheckoutSession({
        organizationId: org.id,
        userId: 'u-1',
        planId: entPlan.id,
        planPriceId: entPlan.prices[0].id,
        successUrl: 'http://localhost:3005/success',
        cancelUrl: 'http://localhost:3005/cancel',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('handles checkout, renewal, failed payment, duplicate/out-of-order webhooks, refund & cancellation end-to-end', async () => {
    const org = await prisma.organization.create({
      data: {
        name: 'Phase 5 Full Lifecycle Org',
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

    const paidPlan = await prisma.subscriptionPlan.create({
      data: {
        profileType: SubscriptionProfileType.RETAIL,
        code: `RET_PRO_P5_${Date.now()}`,
        name: 'Retail Pro P5',
        tier: SubscriptionPlanTier.PRO,
        isFree: false,
        isEnterprise: false,
        prices: {
          create: {
            interval: SubscriptionBillingInterval.MONTHLY,
            unitAmountMinor: 7900,
            currency: 'AUD',
            isActive: true,
          },
        },
      },
      include: { prices: true },
    });
    createdPlanIds.push(paidPlan.id);

    let nextEvent: any;
    const adapter = makeMockAdapter({
      verifyImpl: () => nextEvent,
    });
    const billing = new SubscriptionBillingService(
      prisma as any,
      makeMockFlags({
        SUBSCRIPTIONS_ENABLED: true,
        SUBSCRIPTION_CHECKOUT_ENABLED: true,
        [EXISTING_STRIPE_SWITCH_KEY]: true,
      }),
      adapter,
      profileResolver,
      lifecycleService,
    );

    const checkout = await billing.createCheckoutSession({
      organizationId: org.id,
      userId: 'u-1',
      userEmail: 'owner@retail.test',
      planId: paidPlan.id,
      planPriceId: paidPlan.prices[0].id,
      successUrl: 'http://localhost:3005/success',
      cancelUrl: 'http://localhost:3005/cancel',
    });
    expect(checkout.sessionId).toBe('cs_test_123');

    const baseSec = Math.floor(Date.now() / 1000);
    const extSubId = `sub_stripe_${Date.now()}`;
    const extPi1 = `pi_1_${Date.now()}`;

    // 1. checkout.session.completed -> activates subscription
    nextEvent = {
      id: `evt_test_p5_chk_${Date.now()}`,
      type: 'checkout.session.completed',
      created: baseSec,
      dataObject: {
        id: 'cs_test_123',
        customer: 'cus_123',
        subscription: extSubId,
        payment_intent: extPi1,
        amount_total: 7900,
        currency: 'aud',
        metadata: {
          organizationId: org.id,
          planId: paidPlan.id,
          planPriceId: paidPlan.prices[0].id,
          interval: 'MONTHLY',
        },
      },
    };
    const r1 = await billing.processStripeWebhook(Buffer.from('{}'), 'sig');
    expect(r1.deduplicated).toBe(false);

    // 2. Duplicate delivery -> deduplicated
    const r1Dup = await billing.processStripeWebhook(Buffer.from('{}'), 'sig');
    expect(r1Dup.deduplicated).toBe(true);

    // 3. invoice.payment_failed -> PAST_DUE + FAILED transaction
    nextEvent = {
      id: `evt_test_p5_fail_${Date.now()}`,
      type: 'invoice.payment_failed',
      created: baseSec + 100,
      dataObject: {
        id: 'in_fail_1',
        subscription: extSubId,
        payment_intent: `pi_fail_${Date.now()}`,
        amount_due: 7900,
        currency: 'aud',
      },
    };
    await billing.processStripeWebhook(Buffer.from('{}'), 'sig');
    const pastDueSub = await prisma.organizationSubscription.findFirstOrThrow({
      where: { organizationId: org.id, externalSubscriptionId: extSubId },
    });
    expect(pastDueSub.status).toBe(SubscriptionStatus.PAST_DUE);

    // 4. invoice.paid -> renews back to ACTIVE
    const renewPi = `pi_renew_${Date.now()}`;
    nextEvent = {
      id: `evt_test_p5_renew_${Date.now()}`,
      type: 'invoice.paid',
      created: baseSec + 200,
      dataObject: {
        id: 'in_renew_1',
        subscription: extSubId,
        payment_intent: renewPi,
        amount_paid: 7900,
        currency: 'aud',
        period_start: baseSec + 200,
        period_end: baseSec + 200 + 30 * 86400,
      },
    };
    await billing.processStripeWebhook(Buffer.from('{}'), 'sig');
    const renewedSub = await prisma.organizationSubscription.findUniqueOrThrow({
      where: { id: pastDueSub.id },
    });
    expect(renewedSub.status).toBe(SubscriptionStatus.ACTIVE);

    // 5. Out-of-order stale failure event (created < currentPeriodStart) -> ignored
    nextEvent = {
      id: `evt_test_p5_stale_${Date.now()}`,
      type: 'invoice.payment_failed',
      created: baseSec - 500,
      dataObject: {
        id: 'in_stale',
        subscription: extSubId,
      },
    };
    const staleRes = await billing.processStripeWebhook(Buffer.from('{}'), 'sig');
    expect(staleRes.ignored).toBe(true);

    // 6. Refund via webhook & admin refund method
    nextEvent = {
      id: `evt_test_p5_ref_${Date.now()}`,
      type: 'charge.refunded',
      created: baseSec + 300,
      dataObject: {
        payment_intent: extPi1,
        amount_refunded: 7900,
      },
    };
    await billing.processStripeWebhook(Buffer.from('{}'), 'sig');
    const refundedTx =
      await prisma.subscriptionPaymentTransaction.findUniqueOrThrow({
        where: { externalPaymentId: extPi1 },
      });
    expect(refundedTx.status).toBe(SubscriptionPaymentStatus.REFUNDED);

    const adminRefunded = await billing.refundTransaction(
      (
        await prisma.subscriptionPaymentTransaction.findUniqueOrThrow({
          where: { externalPaymentId: renewPi },
        })
      ).id,
      'Customer goodwill refund',
      'admin-1',
    );
    expect(adminRefunded.status).toBe(SubscriptionPaymentStatus.REFUNDED);

    // 7. customer.subscription.deleted -> cancels immediately
    nextEvent = {
      id: `evt_test_p5_del_${Date.now()}`,
      type: 'customer.subscription.deleted',
      created: baseSec + 400,
      dataObject: { id: extSubId },
    };
    await billing.processStripeWebhook(Buffer.from('{}'), 'sig');
    const canceledSub = await prisma.organizationSubscription.findUniqueOrThrow({
      where: { id: pastDueSub.id },
    });
    expect(canceledSub.status).toBe(SubscriptionStatus.CANCELED);
  });
});
