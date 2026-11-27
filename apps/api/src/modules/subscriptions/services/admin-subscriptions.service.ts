import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Prisma,
  SubscriptionActorType,
  SubscriptionBillingInterval,
  SubscriptionFeatureValueType,
  SubscriptionPlanTier,
  SubscriptionProfileType,
  SubscriptionSource,
  SubscriptionStatus,
  SubscriptionTaxBehavior,
} from '@prisma/client';
import { FeatureFlagService } from '../../admin/feature-flag.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeSubscriptionAdapter } from '../payments/stripe-subscription.adapter';
import { EnterpriseOverrideService } from './enterprise-override.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { BLOCKING_SUBSCRIPTION_STATUSES } from './subscription-provisioning.service';

@Injectable()
export class AdminSubscriptionsService {
  private readonly logger = new Logger(AdminSubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycleService: SubscriptionLifecycleService,
    private readonly overrideService: EnterpriseOverrideService,
    private readonly featureFlagService: FeatureFlagService,
    @Optional() private readonly stripeAdapter?: StripeSubscriptionAdapter,
  ) {}

  async getOverviewMetrics() {
    const [
      totalSubscribedOrgs,
      freeCount,
      paidCount,
      enterpriseCount,
      byStatus,
    ] = await Promise.all([
      this.prisma.organizationSubscription.count({
        where: { status: { in: BLOCKING_SUBSCRIPTION_STATUSES } },
      }),
      this.prisma.organizationSubscription.count({
        where: {
          status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
          plan: { isFree: true },
        },
      }),
      this.prisma.organizationSubscription.count({
        where: {
          status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
          plan: { isFree: false, isEnterprise: false },
        },
      }),
      this.prisma.organizationSubscription.count({
        where: {
          status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
          OR: [
            { plan: { isEnterprise: true } },
            { source: SubscriptionSource.ENTERPRISE_CONTRACT },
          ],
        },
      }),
      this.prisma.organizationSubscription.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {
      ACTIVE: 0,
      TRIALING: 0,
      PAST_DUE: 0,
      GRACE_PERIOD: 0,
      EXPIRED: 0,
      CANCELED: 0,
      SUSPENDED: 0,
    };

    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
    }

    return {
      totalSubscribedOrganizations: totalSubscribedOrgs,
      freeSubscriptions: freeCount,
      paidSubscriptions: paidCount,
      enterpriseSubscriptions: enterpriseCount,
      statusCounts,
    };
  }

  async listOrganizationSubscriptions(filters: {
    search?: string;
    profileType?: SubscriptionProfileType;
    planId?: string;
    status?: SubscriptionStatus;
    limit?: number;
  }) {
    const where: Prisma.OrganizationSubscriptionWhereInput = {
      ...(filters.profileType ? { profileType: filters.profileType } : {}),
      ...(filters.planId ? { planId: filters.planId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            organization: {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { id: { equals: filters.search } },
              ],
            },
          }
        : {}),
    };

    return this.prisma.organizationSubscription.findMany({
      where,
      take: Math.min(filters.limit ?? 50, 100),
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            businessCategory: true,
            status: true,
          },
        },
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            tier: true,
            isFree: true,
            isEnterprise: true,
          },
        },
        planPrice: true,
      },
    });
  }

  async getOrganizationSubscriptionDetail(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        type: true,
        businessCategory: true,
        status: true,
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }

    const [subscriptions, snapshots, overrides, transactions, auditEvents] =
      await Promise.all([
        this.prisma.organizationSubscription.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          include: { plan: true, planPrice: true },
        }),
        this.prisma.subscriptionEntitlementSnapshot.findMany({
          where: { organizationId },
          orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
        }),
        this.prisma.organizationEntitlementOverride.findMany({
          where: { organizationId },
          include: { feature: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.subscriptionPaymentTransaction.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.subscriptionAuditEvent.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      ]);

    return {
      organization,
      currentSubscription:
        subscriptions.find((s) =>
          BLOCKING_SUBSCRIPTION_STATUSES.includes(s.status),
        ) ?? null,
      history: subscriptions,
      snapshots,
      overrides,
      transactions,
      auditEvents,
    };
  }

  async assignOrReplaceOrganizationSubscription(
    organizationId: string,
    body: {
      planId: string;
      planPriceId?: string;
      billingInterval: SubscriptionBillingInterval;
      source?: SubscriptionSource;
      currentPeriodEnd?: string | null;
      replaceExplicit?: boolean;
      reason: string;
      enterpriseBillingDetails?: Record<string, unknown>;
    },
    adminId: string,
  ) {
    if (!body.reason?.trim()) {
      throw new BadRequestException('Assignment reason is required');
    }

    const existing = await this.prisma.organizationSubscription.findFirst({
      where: {
        organizationId,
        status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
      },
      select: { id: true, status: true },
    });

    if (existing && !body.replaceExplicit) {
      throw new ConflictException(
        'Organization already has a current subscription; set replaceExplicit=true to replace it explicitly',
      );
    }

    return this.lifecycleService.replaceSubscription({
      organizationId,
      newPlanId: body.planId,
      planPriceId: body.planPriceId ?? null,
      billingInterval: body.billingInterval,
      source: body.source ?? SubscriptionSource.MANUAL_ADMIN,
      currentPeriodEnd: body.currentPeriodEnd
        ? new Date(body.currentPeriodEnd)
        : null,
      enterpriseBillingDetails:
        body.enterpriseBillingDetails as Prisma.InputJsonValue | undefined,
      actor: {
        actorId: adminId,
        actorType: SubscriptionActorType.USER,
        reason: body.reason.trim(),
      },
    });
  }

  async suspendOrganizationSubscription(
    organizationId: string,
    subscriptionId: string,
    reason: string,
    adminId: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Suspension reason is required');
    }
    return this.lifecycleService.suspendSubscription(
      subscriptionId,
      organizationId,
      {
        actorId: adminId,
        actorType: SubscriptionActorType.USER,
        reason: reason.trim(),
      },
    );
  }

  async reactivateOrganizationSubscription(
    organizationId: string,
    subscriptionId: string,
    reason: string,
    adminId: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Reactivation reason is required');
    }
    return this.lifecycleService.reactivateSubscription(
      subscriptionId,
      organizationId,
      {
        actorId: adminId,
        actorType: SubscriptionActorType.USER,
        reason: reason.trim(),
      },
    );
  }

  async cancelOrganizationSubscription(
    organizationId: string,
    subscriptionId: string,
    reason: string,
    adminId: string,
    immediate = true,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Cancellation reason is required');
    }

    const existing = await this.prisma.organizationSubscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundException(
        `Subscription ${subscriptionId} not found for organization ${organizationId}`,
      );
    }

    // Idempotent retry handling: already canceled (or already scheduled at period end)
    if (existing.status === SubscriptionStatus.CANCELED) {
      return existing;
    }
    if (!immediate && existing.cancelAtPeriodEnd) {
      return existing;
    }

    let effectiveReason = reason.trim();

    if (existing.source === SubscriptionSource.ONLINE_CHECKOUT) {
      if (existing.externalSubscriptionId) {
        if (!this.stripeAdapter) {
          throw new ServiceUnavailableException(
            'Stripe adapter is not available to cancel ONLINE_CHECKOUT subscription',
          );
        }
        await this.stripeAdapter.cancelExternalSubscription(
          existing.externalSubscriptionId,
          immediate,
        );
      } else {
        this.logger.warn(
          `ONLINE_CHECKOUT subscription ${subscriptionId} has no externalSubscriptionId; proceeding with local cancellation only`,
        );
        effectiveReason = `${effectiveReason} [No external Stripe subscription ID on record]`;
      }
    }

    const actor = {
      actorId: adminId,
      actorType: SubscriptionActorType.USER,
      reason: effectiveReason,
    };
    return immediate
      ? this.lifecycleService.cancelImmediately(
          subscriptionId,
          organizationId,
          actor,
        )
      : this.lifecycleService.scheduleCancellationAtPeriodEnd(
          subscriptionId,
          organizationId,
          actor,
        );
  }

  async listPlans(profileType?: SubscriptionProfileType) {
    return this.prisma.subscriptionPlan.findMany({
      where: profileType ? { profileType } : undefined,
      orderBy: [{ profileType: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        prices: {
          orderBy: [
            { interval: 'asc' },
            { currency: 'asc' },
            { priceVersion: 'desc' },
          ],
        },
        featureLimits: {
          include: { feature: true },
          orderBy: { planVersion: 'desc' },
        },
      },
    });
  }

  async createPlan(
    body: {
      profileType: SubscriptionProfileType;
      code: string;
      name: string;
      description?: string;
      tier: SubscriptionPlanTier;
      isFree?: boolean;
      isEnterprise?: boolean;
      isActive?: boolean;
      isPublic?: boolean;
      gracePeriodDays?: number;
      sortOrder?: number;
    },
    adminId: string,
  ) {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        profileType: body.profileType,
        code: body.code.trim().toUpperCase(),
        planVersion: 1,
        name: body.name.trim(),
        description: body.description?.trim() ?? null,
        tier: body.tier,
        isFree: body.isFree ?? body.tier === SubscriptionPlanTier.FREE,
        isEnterprise:
          body.isEnterprise ?? body.tier === SubscriptionPlanTier.ENTERPRISE,
        isActive: body.isActive ?? true,
        isPublic: body.isPublic ?? true,
        gracePeriodDays: body.gracePeriodDays ?? 7,
        sortOrder: body.sortOrder ?? 0,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorType: 'USER',
        action: 'subscription.plan.created',
        resourceType: 'SubscriptionPlan',
        resourceId: plan.id,
        changes: plan as unknown as Prisma.InputJsonValue,
      },
    });

    return plan;
  }

  async updatePlan(
    planId: string,
    body: {
      name?: string;
      description?: string;
      isActive?: boolean;
      isPublic?: boolean;
      sortOrder?: number;
    },
    adminId: string,
  ) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!existing) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description?.trim() ?? null }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorType: 'USER',
        action: 'subscription.plan.updated',
        resourceType: 'SubscriptionPlan',
        resourceId: planId,
        changes: body as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  /**
   * Creates a new immutable priceVersion for (planId, interval, currency)
   * without overwriting historical contracted prices.
   */
  async upsertPlanPrice(
    planId: string,
    body: {
      interval: SubscriptionBillingInterval;
      unitAmountMinor: number;
      currency: string;
      currencyDecimals?: number;
      taxBehavior?: SubscriptionTaxBehavior;
      taxRateBps?: number | null;
    },
    adminId: string,
  ) {
    const currency = body.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException(
        'Currency must be a 3-letter ISO-4217 code (e.g., AUD, USD, INR, GBP)',
      );
    }
    if (!Number.isInteger(body.unitAmountMinor) || body.unitAmountMinor < 0) {
      throw new BadRequestException(
        'unitAmountMinor must be a non-negative integer',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: planId },
      });
      if (!plan) {
        throw new NotFoundException(`Plan ${planId} not found`);
      }

      const latestPrice = await tx.subscriptionPlanPrice.findFirst({
        where: { planId, interval: body.interval, currency },
        orderBy: { priceVersion: 'desc' },
      });

      const now = new Date();
      if (latestPrice && latestPrice.isActive) {
        await tx.subscriptionPlanPrice.update({
          where: { id: latestPrice.id },
          data: { isActive: false, effectiveTo: now },
        });
      }

      const nextPrice = await tx.subscriptionPlanPrice.create({
        data: {
          planId,
          priceVersion: (latestPrice?.priceVersion ?? 0) + 1,
          interval: body.interval,
          unitAmountMinor: body.unitAmountMinor,
          currency,
          currencyDecimals: body.currencyDecimals ?? 2,
          taxBehavior: body.taxBehavior ?? SubscriptionTaxBehavior.UNSPECIFIED,
          taxRateBps: body.taxRateBps ?? null,
          isActive: true,
          effectiveFrom: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'USER',
          action: 'subscription.plan_price.created',
          resourceType: 'SubscriptionPlanPrice',
          resourceId: nextPrice.id,
          changes: {
            planId,
            interval: body.interval,
            currency,
            unitAmountMinor: body.unitAmountMinor,
            priceVersion: nextPrice.priceVersion,
          } as Prisma.InputJsonValue,
        },
      });

      return nextPrice;
    });
  }

  /**
   * Publishes a new planVersion with updated feature limits so existing
   * subscriptions pinned to older planVersion numbers are never altered unexpectedly.
   */
  async updatePlanFeatureLimits(
    planId: string,
    limits: Array<{
      featureId: string;
      enabled: boolean;
      limitValue: number | null;
    }>,
    adminId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: planId },
      });
      if (!plan) {
        throw new NotFoundException(`Plan ${planId} not found`);
      }

      const nextVersion = plan.planVersion + 1;

      for (const item of limits) {
        const feature = await tx.subscriptionFeature.findUnique({
          where: { id: item.featureId },
        });
        if (!feature) {
          throw new NotFoundException(`Feature ${item.featureId} not found`);
        }
        if (!feature.applicableProfiles.includes(plan.profileType)) {
          throw new BadRequestException(
            `Feature ${feature.key} does not apply to ${plan.profileType}`,
          );
        }
        if (
          feature.valueType === SubscriptionFeatureValueType.NUMERIC_LIMIT &&
          item.limitValue !== null &&
          (!Number.isInteger(item.limitValue) || item.limitValue < 0)
        ) {
          throw new BadRequestException(
            `Numeric limit for ${feature.key} must be >= 0 or null`,
          );
        }

        await tx.planFeatureLimit.create({
          data: {
            planId,
            planVersion: nextVersion,
            featureId: item.featureId,
            enabled: item.enabled,
            limitValue:
              feature.valueType === SubscriptionFeatureValueType.BOOLEAN
                ? null
                : item.limitValue,
          },
        });
      }

      const updatedPlan = await tx.subscriptionPlan.update({
        where: { id: planId },
        data: { planVersion: nextVersion },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'USER',
          action: 'subscription.plan_limits.versioned',
          resourceType: 'SubscriptionPlan',
          resourceId: planId,
          changes: {
            previousPlanVersion: plan.planVersion,
            newPlanVersion: nextVersion,
            limitsCount: limits.length,
          } as Prisma.InputJsonValue,
        },
      });

      return updatedPlan;
    });
  }

  async listFeatures() {
    return this.prisma.subscriptionFeature.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async createFeature(
    body: {
      key: string;
      name: string;
      description?: string;
      valueType: SubscriptionFeatureValueType;
      applicableProfiles: SubscriptionProfileType[];
      isActive?: boolean;
    },
    adminId: string,
  ) {
    const feature = await this.prisma.subscriptionFeature.create({
      data: {
        key: body.key.trim().toUpperCase(),
        name: body.name.trim(),
        description: body.description?.trim() ?? null,
        valueType: body.valueType,
        applicableProfiles: body.applicableProfiles,
        isActive: body.isActive ?? true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorType: 'USER',
        action: 'subscription.feature.created',
        resourceType: 'SubscriptionFeature',
        resourceId: feature.id,
        changes: feature as unknown as Prisma.InputJsonValue,
      },
    });

    return feature;
  }

  async updateFeature(
    featureId: string,
    body: {
      name?: string;
      description?: string;
      applicableProfiles?: SubscriptionProfileType[];
      isActive?: boolean;
    },
    adminId: string,
  ) {
    const updated = await this.prisma.subscriptionFeature.update({
      where: { id: featureId },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description?.trim() ?? null }
          : {}),
        ...(body.applicableProfiles !== undefined
          ? { applicableProfiles: body.applicableProfiles }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorType: 'USER',
        action: 'subscription.feature.updated',
        resourceType: 'SubscriptionFeature',
        resourceId: featureId,
        changes: body as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async listEnterpriseSubscriptions() {
    return this.prisma.organizationSubscription.findMany({
      where: {
        OR: [
          { plan: { isEnterprise: true } },
          { source: SubscriptionSource.ENTERPRISE_CONTRACT },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        organization: {
          select: { id: true, name: true, type: true, businessCategory: true },
        },
        plan: true,
        overrides: { include: { feature: true } },
      },
    });
  }

  async updateEnterpriseContract(
    organizationId: string,
    subscriptionId: string,
    body: {
      currentPeriodStart?: string;
      currentPeriodEnd?: string | null;
      enterpriseBillingDetails?: Record<string, unknown>;
      reason: string;
    },
    adminId: string,
  ) {
    if (!body.reason?.trim()) {
      throw new BadRequestException('Contract update reason is required');
    }

    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub || sub.organizationId !== organizationId) {
      throw new NotFoundException(
        'Subscription not found for this organization',
      );
    }

    const updated = await this.prisma.organizationSubscription.update({
      where: { id: subscriptionId },
      data: {
        ...(body.currentPeriodStart
          ? { currentPeriodStart: new Date(body.currentPeriodStart) }
          : {}),
        ...(body.currentPeriodEnd !== undefined
          ? {
              currentPeriodEnd: body.currentPeriodEnd
                ? new Date(body.currentPeriodEnd)
                : null,
            }
          : {}),
        ...(body.enterpriseBillingDetails !== undefined
          ? {
              enterpriseBillingDetails:
                body.enterpriseBillingDetails as Prisma.InputJsonValue,
            }
          : {}),
      },
    });

    await this.prisma.subscriptionAuditEvent.create({
      data: {
        organizationId,
        subscriptionId,
        actorId: adminId,
        actorType: SubscriptionActorType.USER,
        action: 'ENTERPRISE_CONTRACT_UPDATED',
        beforeState: {
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          enterpriseBillingDetails: sub.enterpriseBillingDetails,
        } as Prisma.InputJsonValue,
        afterState: {
          currentPeriodStart: updated.currentPeriodStart,
          currentPeriodEnd: updated.currentPeriodEnd,
          enterpriseBillingDetails: updated.enterpriseBillingDetails,
        } as Prisma.InputJsonValue,
        reason: body.reason.trim(),
      },
    });

    return updated;
  }

  async upsertEnterpriseOverride(
    organizationId: string,
    subscriptionId: string,
    body: {
      featureKey: string;
      enabled: boolean;
      limitValue: number | null;
      expiresAt?: string | null;
      reason: string;
    },
    adminId: string,
  ) {
    return this.overrideService.upsertOverride({
      organizationId,
      subscriptionId,
      featureKey: body.featureKey,
      enabled: body.enabled,
      limitValue: body.limitValue,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      reason: body.reason,
      actorId: adminId,
      actorType: SubscriptionActorType.USER,
    });
  }

  async removeEnterpriseOverride(
    organizationId: string,
    subscriptionId: string,
    featureKey: string,
    reason: string,
    adminId: string,
  ) {
    return this.overrideService.removeOverride({
      organizationId,
      subscriptionId,
      featureKey,
      reason,
      actorId: adminId,
      actorType: SubscriptionActorType.USER,
    });
  }

  async getSubscriptionSwitches() {
    const keys = [
      'SUBSCRIPTIONS_ENABLED',
      'SUBSCRIPTION_ENFORCEMENT_ENABLED',
      'SUBSCRIPTION_CHECKOUT_ENABLED',
    ];
    return Promise.all(
      keys.map((key) => this.featureFlagService.getFeatureState(key)),
    );
  }

  async setSubscriptionSwitch(key: string, enabled: boolean, adminId: string) {
    const allowed = [
      'SUBSCRIPTIONS_ENABLED',
      'SUBSCRIPTION_ENFORCEMENT_ENABLED',
      'SUBSCRIPTION_CHECKOUT_ENABLED',
    ];
    if (!allowed.includes(key)) {
      throw new BadRequestException(`Unknown subscription switch: ${key}`);
    }
    return this.featureFlagService.setFeatureState(key, enabled, adminId);
  }
}
