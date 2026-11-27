import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Prisma,
  SubscriptionActorType,
  SubscriptionBillingInterval,
  SubscriptionBillingPeriodStatus,
  SubscriptionPaymentStatus,
  SubscriptionSource,
  SubscriptionStatus,
  SubscriptionWebhookStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { FeatureFlagService } from '../../admin/feature-flag.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SubscriptionDomainException,
  SubscriptionErrorCode,
} from '../errors/subscription-domain.error';
import { StripeSubscriptionAdapter } from '../payments/stripe-subscription.adapter';
import { ProfileTypeResolverService } from './profile-type-resolver.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { BLOCKING_SUBSCRIPTION_STATUSES } from './subscription-provisioning.service';

export const EXISTING_STRIPE_SWITCH_KEY = 'PAYMENTS_BOOKING';

@Injectable()
export class SubscriptionBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly stripeAdapter: StripeSubscriptionAdapter,
    private readonly profileResolver: ProfileTypeResolverService,
    private readonly lifecycleService: SubscriptionLifecycleService,
  ) {}

  async getBillingReadiness() {
    const [subscriptionsEnabled, checkoutEnabled, stripeSwitchEnabled] =
      await Promise.all([
        this.featureFlagService.isEnabled('SUBSCRIPTIONS_ENABLED'),
        this.featureFlagService.isEnabled('SUBSCRIPTION_CHECKOUT_ENABLED'),
        this.featureFlagService.isEnabled(EXISTING_STRIPE_SWITCH_KEY),
      ]);

    const stripeApiKeyConfigured = this.stripeAdapter.isConfigured();
    const stripeWebhookConfigured = this.stripeAdapter.isWebhookConfigured();

    const reasons: string[] = [];
    if (!subscriptionsEnabled) reasons.push('SUBSCRIPTIONS_ENABLED is OFF');
    if (!checkoutEnabled) reasons.push('SUBSCRIPTION_CHECKOUT_ENABLED is OFF');
    if (!stripeSwitchEnabled) {
      reasons.push(`Existing Stripe switch (${EXISTING_STRIPE_SWITCH_KEY}) is OFF`);
    }
    if (!stripeApiKeyConfigured) {
      reasons.push('STRIPE_SECRET_KEY is not configured');
    }
    if (!stripeWebhookConfigured) {
      reasons.push('Stripe webhook secret is not configured');
    }

    return {
      subscriptionsEnabled,
      checkoutEnabled,
      stripeSwitchKey: EXISTING_STRIPE_SWITCH_KEY,
      stripeSwitchEnabled,
      stripeApiKeyConfigured,
      stripeWebhookConfigured,
      checkoutReady:
        subscriptionsEnabled &&
        checkoutEnabled &&
        stripeSwitchEnabled &&
        stripeApiKeyConfigured &&
        stripeWebhookConfigured,
      reasons,
    };
  }

  async assertCheckoutEligible() {
    const readiness = await this.getBillingReadiness();
    if (!readiness.subscriptionsEnabled) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.SUBSCRIPTIONS_DISABLED,
        'Subscriptions are currently disabled',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!readiness.checkoutEnabled) {
      throw new ServiceUnavailableException(
        'Subscription online checkout is currently disabled',
      );
    }
    if (!readiness.stripeSwitchEnabled) {
      throw new ServiceUnavailableException(
        `Stripe payments are currently disabled (${EXISTING_STRIPE_SWITCH_KEY})`,
      );
    }
    if (!readiness.stripeApiKeyConfigured) {
      throw new ServiceUnavailableException(
        'Stripe payment credentials are not configured',
      );
    }
    return readiness;
  }

  async createCheckoutSession(params: {
    organizationId: string;
    userId: string;
    userEmail?: string;
    planId: string;
    planPriceId: string;
    successUrl: string;
    cancelUrl: string;
    idempotencyKey?: string;
  }) {
    await this.assertCheckoutEligible();

    const org = await this.prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { id: true, type: true, businessCategory: true, deletedAt: true },
    });
    if (!org || org.deletedAt) {
      throw new NotFoundException('Organization not found');
    }

    const resolved = this.profileResolver.resolve(org);
    if (!resolved.eligible) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.PROFILE_MISMATCH,
        `Organization profile is not eligible (${resolved.reason})`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: params.planId },
    });
    if (!plan || !plan.isActive || !plan.isPublic) {
      throw new BadRequestException('Selected plan is not available for purchase');
    }
    if (plan.profileType !== resolved.profileType) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.PROFILE_MISMATCH,
        `Plan profile ${plan.profileType} does not match organization profile ${resolved.profileType}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (plan.isFree) {
      throw new BadRequestException(
        'Free subscriptions do not require Stripe checkout',
      );
    }
    if (plan.isEnterprise) {
      throw new BadRequestException(
        'Enterprise subscriptions require manual contract assignment by an administrator',
      );
    }

    const planPrice = await this.prisma.subscriptionPlanPrice.findUnique({
      where: { id: params.planPriceId },
    });
    if (
      !planPrice ||
      planPrice.planId !== plan.id ||
      !planPrice.isActive ||
      (planPrice.interval !== 'MONTHLY' &&
        planPrice.interval !== 'QUARTERLY' &&
        planPrice.interval !== 'ANNUAL')
    ) {
      throw new BadRequestException('Selected plan price is invalid or inactive');
    }

    const currentSub = await this.prisma.organizationSubscription.findFirst({
      where: {
        organizationId: org.id,
        status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
      },
      select: { id: true, externalCustomerId: true },
    });

    const idempotencyKey =
      params.idempotencyKey?.trim() ||
      `sub-chk-${org.id}-${planPrice.id}-${crypto.randomUUID()}`;

    const session = await this.stripeAdapter.createCheckoutSession({
      organizationId: org.id,
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      planPriceId: planPrice.id,
      unitAmountMinor: planPrice.unitAmountMinor,
      currency: planPrice.currency,
      interval: planPrice.interval,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      idempotencyKey,
      customerEmail: params.userEmail,
      externalCustomerId: currentSub?.externalCustomerId ?? null,
    });

    if (currentSub) {
      await this.prisma.subscriptionPaymentTransaction.create({
        data: {
          organizationId: org.id,
          subscriptionId: currentSub.id,
          provider: 'STRIPE',
          idempotencyKey,
          amountMinor: planPrice.unitAmountMinor,
          currency: planPrice.currency,
          status: SubscriptionPaymentStatus.PENDING,
          metadata: {
            checkoutSessionId: session.sessionId,
            planId: plan.id,
            planPriceId: planPrice.id,
            initiatedByUserId: params.userId,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return {
      sessionId: session.sessionId,
      checkoutUrl: session.checkoutUrl,
      idempotencyKey,
    };
  }

  async processStripeWebhook(rawBody: Buffer, signature: string) {
    // 1. Check webhook secret & verify Stripe signature first
    const event = this.stripeAdapter.verifyAndParseWebhook(rawBody, signature);

    // 2. Check existing Stripe switch
    const stripeSwitchEnabled = await this.featureFlagService.isEnabled(
      EXISTING_STRIPE_SWITCH_KEY,
    );
    if (!stripeSwitchEnabled) {
      throw new ServiceUnavailableException(
        `Stripe webhooks rejected while ${EXISTING_STRIPE_SWITCH_KEY} is disabled`,
      );
    }

    // 3. Idempotent deduplication via SubscriptionWebhookEvent
    const existing = await this.prisma.subscriptionWebhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: 'STRIPE',
          externalEventId: event.id,
        },
      },
    });

    if (
      existing &&
      (existing.status === SubscriptionWebhookStatus.PROCESSED ||
        existing.status === SubscriptionWebhookStatus.IGNORED)
    ) {
      return { received: true, deduplicated: true, eventId: event.id };
    }

    let webhookRow = existing;
    if (!webhookRow) {
      try {
        webhookRow = await this.prisma.subscriptionWebhookEvent.create({
          data: {
            provider: 'STRIPE',
            externalEventId: event.id,
            eventType: event.type,
            status: SubscriptionWebhookStatus.RECEIVED,
            payload: event.dataObject as Prisma.InputJsonValue,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const concurrent =
            await this.prisma.subscriptionWebhookEvent.findUnique({
              where: {
                provider_externalEventId: {
                  provider: 'STRIPE',
                  externalEventId: event.id,
                },
              },
            });
          if (
            concurrent &&
            (concurrent.status === SubscriptionWebhookStatus.PROCESSED ||
              concurrent.status === SubscriptionWebhookStatus.IGNORED)
          ) {
            return { received: true, deduplicated: true, eventId: event.id };
          }
          if (concurrent) {
            webhookRow = concurrent;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    try {
      const result = await this.dispatchVerifiedWebhook(event);
      await this.prisma.subscriptionWebhookEvent.update({
        where: { id: webhookRow.id },
        data: {
          status: result.ignored
            ? SubscriptionWebhookStatus.IGNORED
            : SubscriptionWebhookStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
      return {
        received: true,
        deduplicated: false,
        eventId: event.id,
        ignored: result.ignored ?? false,
      };
    } catch (err: any) {
      await this.prisma.subscriptionWebhookEvent.update({
        where: { id: webhookRow.id },
        data: {
          status: SubscriptionWebhookStatus.FAILED,
          error: err?.message || 'Webhook processing error',
        },
      });
      throw err;
    }
  }

  private computePeriodEnd(
    start: Date,
    interval: SubscriptionBillingInterval,
  ): Date {
    const end = new Date(start);
    if (interval === SubscriptionBillingInterval.ANNUAL) {
      end.setUTCFullYear(end.getUTCFullYear() + 1);
    } else if (interval === SubscriptionBillingInterval.QUARTERLY) {
      end.setUTCMonth(end.getUTCMonth() + 3);
    } else {
      end.setUTCMonth(end.getUTCMonth() + 1);
    }
    return end;
  }

  private async findOrCreateBillingPeriod(params: {
    subscriptionId: string;
    organizationId: string;
    planPriceId: string | null;
    unitAmountMinor: number;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
  }) {
    const windowMs = 12 * 60 * 60 * 1000;
    const minStart = new Date(params.periodStart.getTime() - windowMs);
    const maxStart = new Date(params.periodStart.getTime() + windowMs);

    const existing = await this.prisma.subscriptionBillingPeriod.findFirst({
      where: {
        subscriptionId: params.subscriptionId,
        periodStart: { gte: minStart, lte: maxStart },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.subscriptionBillingPeriod.create({
      data: {
        subscriptionId: params.subscriptionId,
        organizationId: params.organizationId,
        planPriceId: params.planPriceId,
        unitAmountMinor: params.unitAmountMinor,
        currency: params.currency,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        status: SubscriptionBillingPeriodStatus.PAID,
      },
    });
  }

  private async upsertSucceededTransaction(params: {
    organizationId: string;
    subscriptionId: string;
    billingPeriodId: string;
    externalPaymentId: string;
    idempotencyKey: string;
    amountMinor: number;
    currency: string;
    checkoutSessionId?: string;
    metadata: Record<string, unknown>;
  }) {
    if (params.checkoutSessionId) {
      const pendingTx =
        await this.prisma.subscriptionPaymentTransaction.findFirst({
          where: {
            organizationId: params.organizationId,
            status: SubscriptionPaymentStatus.PENDING,
            metadata: {
              path: ['checkoutSessionId'],
              equals: params.checkoutSessionId,
            },
          },
          orderBy: { createdAt: 'desc' },
        });

      if (pendingTx) {
        return this.prisma.subscriptionPaymentTransaction.update({
          where: { id: pendingTx.id },
          data: {
            subscriptionId: params.subscriptionId,
            billingPeriodId: params.billingPeriodId,
            externalPaymentId: params.externalPaymentId,
            amountMinor: params.amountMinor,
            currency: params.currency,
            status: SubscriptionPaymentStatus.SUCCEEDED,
            metadata: {
              ...((pendingTx.metadata as Record<string, unknown>) || {}),
              ...params.metadata,
            } as Prisma.InputJsonValue,
          },
        });
      }
    }

    return this.prisma.subscriptionPaymentTransaction.upsert({
      where: { externalPaymentId: params.externalPaymentId },
      update: {
        status: SubscriptionPaymentStatus.SUCCEEDED,
        subscriptionId: params.subscriptionId,
        billingPeriodId: params.billingPeriodId,
      },
      create: {
        organizationId: params.organizationId,
        subscriptionId: params.subscriptionId,
        billingPeriodId: params.billingPeriodId,
        provider: 'STRIPE',
        externalPaymentId: params.externalPaymentId,
        idempotencyKey: params.idempotencyKey,
        amountMinor: params.amountMinor,
        currency: params.currency,
        status: SubscriptionPaymentStatus.SUCCEEDED,
        metadata: params.metadata as Prisma.InputJsonValue,
      },
    });
  }

  private async dispatchVerifiedWebhook(event: {
    id: string;
    type: string;
    created: number;
    dataObject: Record<string, any>;
  }): Promise<{ ignored?: boolean }> {
    const obj = event.dataObject;
    const eventTime = new Date(event.created * 1000);

    if (event.type === 'checkout.session.completed') {
      const metadata = obj.metadata || {};
      const organizationId = metadata.organizationId as string | undefined;
      const planId = metadata.planId as string | undefined;
      const planPriceId = metadata.planPriceId as string | undefined;
      const interval =
        (metadata.interval as SubscriptionBillingInterval) ||
        SubscriptionBillingInterval.MONTHLY;

      if (!organizationId || !planId || !planPriceId) {
        return { ignored: true };
      }

      const planPrice = await this.prisma.subscriptionPlanPrice.findUnique({
        where: { id: planPriceId },
      });
      if (!planPrice) {
        return { ignored: true };
      }

      const existingCurrent =
        await this.prisma.organizationSubscription.findFirst({
          where: {
            organizationId,
            status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
            source: SubscriptionSource.ONLINE_CHECKOUT,
          },
          orderBy: { createdAt: 'desc' },
        });
      if (
        existingCurrent &&
        eventTime.getTime() < existingCurrent.currentPeriodStart.getTime()
      ) {
        return { ignored: true };
      }

      const currentPeriodEnd = this.computePeriodEnd(eventTime, interval);
      const replaced = await this.lifecycleService.replaceSubscription({
        organizationId,
        newPlanId: planId,
        planPriceId,
        billingInterval: interval,
        source: SubscriptionSource.ONLINE_CHECKOUT,
        currentPeriodStart: eventTime,
        currentPeriodEnd,
        actor: {
          actorId: 'stripe-webhook',
          actorType: SubscriptionActorType.SYSTEM,
          reason: `Stripe checkout completed (${event.id})`,
        },
      });

      const subId = replaced.subscription.id;
      await this.prisma.organizationSubscription.update({
        where: { id: subId },
        data: {
          externalCustomerId: obj.customer ?? null,
          externalSubscriptionId: obj.subscription ?? null,
        },
      });

      const period = await this.findOrCreateBillingPeriod({
        subscriptionId: subId,
        organizationId,
        planPriceId,
        unitAmountMinor: planPrice.unitAmountMinor,
        currency: planPrice.currency,
        periodStart: eventTime,
        periodEnd: currentPeriodEnd,
      });

      const externalPaymentId =
        (obj.payment_intent as string) || `cs_${obj.id}`;
      await this.upsertSucceededTransaction({
        organizationId,
        subscriptionId: subId,
        billingPeriodId: period.id,
        externalPaymentId,
        idempotencyKey: `webhook-${event.id}`,
        amountMinor: obj.amount_total ?? planPrice.unitAmountMinor,
        currency: (obj.currency || planPrice.currency).toUpperCase(),
        checkoutSessionId: obj.id as string | undefined,
        metadata: { stripeEventId: event.id, sessionId: obj.id },
      });

      return {};
    }

    if (event.type === 'invoice.paid') {
      const externalSubscriptionId = obj.subscription as string | undefined;
      if (!externalSubscriptionId) return { ignored: true };

      const sub = await this.prisma.organizationSubscription.findFirst({
        where: { externalSubscriptionId },
        orderBy: { createdAt: 'desc' },
      });
      if (!sub) return { ignored: true };

      // Out-of-order guard: ignore stale invoice events older than currentPeriodStart
      if (eventTime.getTime() < sub.currentPeriodStart.getTime()) {
        return { ignored: true };
      }

      const periodStart = obj.period_start
        ? new Date(obj.period_start * 1000)
        : eventTime;
      const periodEnd = obj.period_end
        ? new Date(obj.period_end * 1000)
        : this.computePeriodEnd(periodStart, sub.billingInterval);

      if (
        sub.status === SubscriptionStatus.ACTIVE ||
        sub.status === SubscriptionStatus.PAST_DUE ||
        sub.status === SubscriptionStatus.GRACE_PERIOD
      ) {
        await this.lifecycleService.renewSubscription(
          sub.id,
          sub.organizationId,
          periodStart,
          periodEnd,
          {
            actorId: 'stripe-webhook',
            actorType: SubscriptionActorType.SYSTEM,
            reason: `Stripe invoice paid (${event.id})`,
          },
        );
      }

      const period = await this.findOrCreateBillingPeriod({
        subscriptionId: sub.id,
        organizationId: sub.organizationId,
        planPriceId: sub.planPriceId,
        unitAmountMinor: obj.amount_paid ?? 0,
        currency: (obj.currency || 'AUD').toUpperCase(),
        periodStart,
        periodEnd,
      });

      const externalPaymentId =
        (obj.payment_intent as string) || `inv_${obj.id}`;
      await this.upsertSucceededTransaction({
        organizationId: sub.organizationId,
        subscriptionId: sub.id,
        billingPeriodId: period.id,
        externalPaymentId,
        idempotencyKey: `webhook-${event.id}`,
        amountMinor: obj.amount_paid ?? 0,
        currency: (obj.currency || 'AUD').toUpperCase(),
        metadata: { stripeEventId: event.id, invoiceId: obj.id },
      });

      return {};
    }

    if (event.type === 'invoice.payment_failed') {
      const externalSubscriptionId = obj.subscription as string | undefined;
      if (!externalSubscriptionId) return { ignored: true };

      const sub = await this.prisma.organizationSubscription.findFirst({
        where: { externalSubscriptionId },
        orderBy: { createdAt: 'desc' },
      });
      if (!sub) return { ignored: true };

      if (eventTime.getTime() < sub.currentPeriodStart.getTime()) {
        return { ignored: true };
      }

      if (
        sub.status === SubscriptionStatus.ACTIVE ||
        sub.status === SubscriptionStatus.TRIALING
      ) {
        await this.lifecycleService.markPastDue(
          sub.id,
          sub.organizationId,
          {
            actorId: 'stripe-webhook',
            actorType: SubscriptionActorType.SYSTEM,
            reason: `Stripe invoice payment failed (${event.id})`,
          },
          eventTime,
        );
      }

      const externalPaymentId =
        (obj.payment_intent as string) || `inv_fail_${obj.id}_${event.id}`;
      await this.prisma.subscriptionPaymentTransaction.upsert({
        where: { externalPaymentId },
        update: { status: SubscriptionPaymentStatus.FAILED },
        create: {
          organizationId: sub.organizationId,
          subscriptionId: sub.id,
          provider: 'STRIPE',
          externalPaymentId,
          idempotencyKey: `webhook-${event.id}`,
          amountMinor: obj.amount_due ?? 0,
          currency: (obj.currency || 'AUD').toUpperCase(),
          status: SubscriptionPaymentStatus.FAILED,
          metadata: { stripeEventId: event.id, invoiceId: obj.id },
        },
      });

      return {};
    }

    if (event.type === 'customer.subscription.deleted') {
      const externalSubscriptionId = obj.id as string | undefined;
      if (!externalSubscriptionId) return { ignored: true };

      const sub = await this.prisma.organizationSubscription.findFirst({
        where: { externalSubscriptionId },
        orderBy: { createdAt: 'desc' },
      });
      if (!sub) return { ignored: true };

      if (
        sub.status !== SubscriptionStatus.CANCELED &&
        sub.status !== SubscriptionStatus.EXPIRED
      ) {
        await this.lifecycleService.cancelImmediately(
          sub.id,
          sub.organizationId,
          {
            actorId: 'stripe-webhook',
            actorType: SubscriptionActorType.SYSTEM,
            reason: `Stripe subscription deleted (${event.id})`,
          },
          eventTime,
        );
      }

      return {};
    }

    if (event.type === 'charge.refunded') {
      const externalPaymentId = obj.payment_intent as string | undefined;
      if (!externalPaymentId) return { ignored: true };

      const txRecord =
        await this.prisma.subscriptionPaymentTransaction.findUnique({
          where: { externalPaymentId },
        });
      if (!txRecord) return { ignored: true };

      const refundedAmount = obj.amount_refunded ?? txRecord.amountMinor;
      const newStatus =
        refundedAmount >= txRecord.amountMinor
          ? SubscriptionPaymentStatus.REFUNDED
          : SubscriptionPaymentStatus.PARTIALLY_REFUNDED;

      await this.prisma.subscriptionPaymentTransaction.update({
        where: { id: txRecord.id },
        data: { status: newStatus },
      });

      await this.prisma.subscriptionAuditEvent.create({
        data: {
          organizationId: txRecord.organizationId,
          subscriptionId: txRecord.subscriptionId,
          actorId: 'stripe-webhook',
          actorType: SubscriptionActorType.SYSTEM,
          action: 'SUBSCRIPTION_PAYMENT_REFUNDED',
          beforeState: { status: txRecord.status } as Prisma.InputJsonValue,
          afterState: {
            status: newStatus,
            amountRefunded: refundedAmount,
          } as Prisma.InputJsonValue,
          reason: `Stripe charge refunded (${event.id})`,
        },
      });

      return {};
    }

    return { ignored: true };
  }

  async listOrganizationBillingHistory(organizationId: string) {
    const [transactions, billingPeriods] = await Promise.all([
      this.prisma.subscriptionPaymentTransaction.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.subscriptionBillingPeriod.findMany({
        where: { organizationId },
        orderBy: { periodStart: 'desc' },
        take: 50,
      }),
    ]);
    return { transactions, billingPeriods };
  }

  async refundTransaction(
    transactionId: string,
    reason: string,
    adminId: string,
    amountMinor?: number,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Refund reason is required');
    }

    const txRecord = await this.prisma.subscriptionPaymentTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!txRecord || !txRecord.externalPaymentId) {
      throw new NotFoundException('Refundable transaction not found');
    }
    if (
      txRecord.status !== SubscriptionPaymentStatus.SUCCEEDED &&
      txRecord.status !== SubscriptionPaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException(
        `Cannot refund transaction in ${txRecord.status} status`,
      );
    }

    const existingMeta = (txRecord.metadata as Record<string, any>) || {};
    const alreadyRefundedMinor =
      typeof existingMeta.refundedMinor === 'number'
        ? existingMeta.refundedMinor
        : 0;
    const remainingMinor = txRecord.amountMinor - alreadyRefundedMinor;

    if (remainingMinor <= 0) {
      throw new BadRequestException('Transaction has already been fully refunded');
    }

    if (amountMinor !== undefined) {
      if (
        typeof amountMinor !== 'number' ||
        !Number.isInteger(amountMinor) ||
        amountMinor <= 0 ||
        amountMinor > txRecord.amountMinor
      ) {
        throw new BadRequestException(
          `Refund amount must be between 1 and ${txRecord.amountMinor} minor units`,
        );
      }
      if (amountMinor > remainingMinor) {
        throw new BadRequestException(
          `Cumulative refund exceeds original transaction amount (remaining refundable: ${remainingMinor})`,
        );
      }
    }

    const effectiveRefundAmount = amountMinor ?? remainingMinor;
    const newRefundedMinor = alreadyRefundedMinor + effectiveRefundAmount;

    const refundResult = await this.stripeAdapter.refundPayment({
      externalPaymentId: txRecord.externalPaymentId,
      amountMinor:
        amountMinor !== undefined ? effectiveRefundAmount : undefined,
      idempotencyKey: `refund-${txRecord.id}-${alreadyRefundedMinor}-${effectiveRefundAmount}`,
    });

    const newStatus =
      newRefundedMinor >= txRecord.amountMinor
        ? SubscriptionPaymentStatus.REFUNDED
        : SubscriptionPaymentStatus.PARTIALLY_REFUNDED;

    const existingRefundIds = Array.isArray(existingMeta.refundIds)
      ? existingMeta.refundIds
      : existingMeta.refundId
        ? [existingMeta.refundId]
        : [];

    const updated = await this.prisma.subscriptionPaymentTransaction.update({
      where: { id: txRecord.id },
      data: {
        status: newStatus,
        metadata: {
          ...existingMeta,
          refundId: refundResult.refundId,
          refundIds: [...existingRefundIds, refundResult.refundId],
          refundedMinor: newRefundedMinor,
          refundReason: reason.trim(),
        } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.subscriptionAuditEvent.create({
      data: {
        organizationId: txRecord.organizationId,
        subscriptionId: txRecord.subscriptionId,
        actorId: adminId,
        actorType: SubscriptionActorType.USER,
        action: 'SUBSCRIPTION_PAYMENT_REFUND_ISSUED',
        beforeState: {
          status: txRecord.status,
          refundedMinor: alreadyRefundedMinor,
        } as Prisma.InputJsonValue,
        afterState: {
          status: newStatus,
          refundId: refundResult.refundId,
          refundAmountMinor: effectiveRefundAmount,
          refundedMinor: newRefundedMinor,
        } as Prisma.InputJsonValue,
        reason: reason.trim(),
      },
    });

    return updated;
  }
}
