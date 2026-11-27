import { HttpStatus, Injectable } from '@nestjs/common';
import {
  OrgStatus,
  SubscriptionFeatureValueType,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CurrentSubscriptionDto,
} from '../dto/current-subscription.dto';
import {
  EntitlementEntryDto,
  OrganizationEntitlementsDto,
} from '../dto/organization-entitlements.dto';
import {
  SubscriptionDomainException,
  SubscriptionErrorCode,
} from '../errors/subscription-domain.error';
import { EntitlementSnapshotService } from './entitlement-snapshot.service';
import { ProfileTypeResolverService } from './profile-type-resolver.service';
import { BLOCKING_SUBSCRIPTION_STATUSES } from './subscription-provisioning.service';
import { SubscriptionStatusService } from './subscription-status.service';

@Injectable()
export class EntitlementResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileResolver: ProfileTypeResolverService,
    private readonly statusService: SubscriptionStatusService,
    private readonly snapshotService: EntitlementSnapshotService,
  ) {}

  async getCurrentSubscriptionSummary(
    organizationId: string,
    now: Date = new Date(),
  ): Promise<CurrentSubscriptionDto> {
    const org = await this.loadEligibleOrganization(organizationId);
    const subscription = await this.loadCurrentOrLatestSubscription(org.id);

    const access = this.statusService.evaluateAccess(
      {
        status: subscription.status,
        billingInterval: subscription.billingInterval,
        isFreePlan: subscription.plan.isFree,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
        graceEndsAt: subscription.graceEndsAt,
        canceledAt: subscription.canceledAt,
      },
      now,
    );

    return {
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
      profileType: subscription.profileType,
      status: access.effectiveStatus,
      effectiveAccessActive: access.isActive,
      inGracePeriod: access.inGracePeriod,
      billingInterval: subscription.billingInterval,
      source: subscription.source,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      startsAt: subscription.startsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      graceEndsAt: subscription.graceEndsAt,
      canceledAt: subscription.canceledAt,
      suspendedAt: subscription.suspendedAt,
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
        tier: subscription.plan.tier,
        planVersion: subscription.planVersion,
        isFree: subscription.plan.isFree,
        isEnterprise: subscription.plan.isEnterprise,
      },
      snapshotId: subscription.currentSnapshotId,
    };
  }

  async resolveForOrganization(
    organizationId: string,
    options?: { at?: Date },
  ): Promise<OrganizationEntitlementsDto> {
    const at = options?.at ?? new Date();
    const org = await this.loadEligibleOrganization(organizationId);
    const subscription = await this.loadCurrentOrLatestSubscription(org.id);

    const access = this.statusService.evaluateAccess(
      {
        status: subscription.status,
        billingInterval: subscription.billingInterval,
        isFreePlan: subscription.plan.isFree,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
        graceEndsAt: subscription.graceEndsAt,
        canceledAt: subscription.canceledAt,
      },
      at,
    );

    const snapshot = subscription.currentSnapshotId
      ? await this.prisma.subscriptionEntitlementSnapshot.findFirst({
          where: {
            id: subscription.currentSnapshotId,
            organizationId: subscription.organizationId,
          },
        })
      : await this.snapshotService.getSnapshotAtTimestamp(
          subscription.id,
          subscription.organizationId,
          at,
        );

    const [activeOverrides, usageCounters] = await Promise.all([
      this.prisma.organizationEntitlementOverride.findMany({
        where: {
          subscriptionId: subscription.id,
          organizationId: subscription.organizationId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
        },
        include: { feature: true },
      }),
      this.prisma.subscriptionUsageCounter.findMany({
        where: { organizationId: subscription.organizationId },
        select: { featureKey: true, currentCount: true },
      }),
    ]);

    const usageByKey = new Map(
      usageCounters.map((u) => [u.featureKey, u.currentCount]),
    );

    const entitlements: Record<string, EntitlementEntryDto> = {};

    // 1. Plan-level feature limits (profile-isolated & active-only)
    for (const limit of subscription.plan.featureLimits) {
      if (
        limit.planVersion !== subscription.planVersion ||
        !limit.feature.isActive ||
        !limit.feature.applicableProfiles.includes(subscription.profileType)
      ) {
        continue;
      }

      entitlements[limit.feature.key] = this.buildEntry(
        limit.feature.key,
        limit.feature.valueType,
        limit.enabled,
        limit.limitValue,
        'PLAN',
        null,
        access.isActive,
        usageByKey.get(limit.feature.key) ?? 0,
      );
    }

    // 2. Organization-level overrides take precedence over plan limits
    for (const ov of activeOverrides) {
      if (
        !ov.feature.isActive ||
        !ov.feature.applicableProfiles.includes(subscription.profileType)
      ) {
        continue;
      }

      entitlements[ov.feature.key] = this.buildEntry(
        ov.feature.key,
        ov.feature.valueType,
        ov.enabled,
        ov.limitValue,
        'ORGANIZATION_OVERRIDE',
        ov.expiresAt,
        access.isActive,
        usageByKey.get(ov.feature.key) ?? 0,
      );
    }

    return {
      organizationId: subscription.organizationId,
      subscriptionId: subscription.id,
      profileType: subscription.profileType,
      planId: subscription.plan.id,
      planCode: subscription.plan.code,
      planVersion: subscription.planVersion,
      subscriptionStatus: access.effectiveStatus,
      effectiveAccessActive: access.isActive,
      effectiveAt: at,
      graceEndsAt: subscription.graceEndsAt,
      snapshotId: snapshot?.id ?? null,
      snapshotVersion: snapshot?.version ?? null,
      entitlements,
    };
  }

  private buildEntry(
    featureKey: string,
    valueType: SubscriptionFeatureValueType,
    rawEnabled: boolean,
    rawLimitValue: number | null,
    source: 'PLAN' | 'ORGANIZATION_OVERRIDE',
    overrideExpiresAt: Date | null,
    subscriptionAccessActive: boolean,
    currentUsage = 0,
  ): EntitlementEntryDto {
    const enabled = subscriptionAccessActive && rawEnabled;

    if (valueType === SubscriptionFeatureValueType.BOOLEAN) {
      return {
        featureKey,
        enabled,
        limitValue: null,
        currentUsage: null,
        unlimited: false,
        source,
        overrideExpiresAt,
      };
    }

    if (rawLimitValue !== null && rawLimitValue < 0) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.INVALID_ENTITLEMENT_OVERRIDE,
        `Negative numeric limit (${rawLimitValue}) for feature ${featureKey} is invalid`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // A disabled feature must never become usable because its limit is null (unlimited)
    const unlimited = enabled && rawLimitValue === null;

    return {
      featureKey,
      enabled,
      limitValue: rawLimitValue,
      currentUsage,
      unlimited,
      source,
      overrideExpiresAt,
    };
  }

  private async loadEligibleOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        type: true,
        status: true,
        businessCategory: true,
        deletedAt: true,
      },
    });

    if (!org || org.deletedAt) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
        'Organization not found or deleted',
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      org.status === OrgStatus.SUSPENDED ||
      org.status === OrgStatus.REJECTED
    ) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.SUBSCRIPTION_SUSPENDED,
        `Organization is ${org.status}`,
        HttpStatus.FORBIDDEN,
      );
    }

    const resolution = this.profileResolver.resolve(org);
    if (!resolution.eligible) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.PROFILE_MISMATCH,
        `Organization is not eligible for business subscriptions (${resolution.reason})`,
        HttpStatus.FORBIDDEN,
        { reason: resolution.reason },
      );
    }

    return org;
  }

  private async loadCurrentOrLatestSubscription(organizationId: string) {
    const blocking = await this.prisma.organizationSubscription.findFirst({
      where: {
        organizationId,
        status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
      },
      include: {
        plan: {
          include: {
            featureLimits: {
              include: { feature: true },
            },
          },
        },
      },
    });

    if (blocking) {
      return blocking;
    }

    const latestHistorical =
      await this.prisma.organizationSubscription.findFirst({
        where: {
          organizationId,
          status: {
            in: [SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELED],
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          plan: {
            include: {
              featureLimits: {
                include: { feature: true },
              },
            },
          },
        },
      });

    if (!latestHistorical) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
        'No subscription found for organization',
        HttpStatus.NOT_FOUND,
      );
    }

    return latestHistorical;
  }
}
