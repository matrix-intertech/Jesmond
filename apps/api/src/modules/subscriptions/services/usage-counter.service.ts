import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, SubscriptionProfileType } from '@prisma/client';
import { FeatureFlagService } from '../../admin/feature-flag.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementResolverService } from './entitlement-resolver.service';

export type SubscriptionRequiredReason =
  | 'NO_ACTIVE_SUBSCRIPTION'
  | 'FEATURE_NOT_INCLUDED'
  | 'USAGE_LIMIT_EXCEEDED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_SUSPENDED';

export function buildSubscriptionRequiredPayload(params: {
  reason: SubscriptionRequiredReason;
  profileType?: SubscriptionProfileType | null;
  featureKey: string;
  message?: string;
}) {
  const profileSlug = params.profileType
    ? params.profileType.toLowerCase()
    : 'accommodation';
  return {
    statusCode: 403,
    code: 'SUBSCRIPTION_REQUIRED',
    reason: params.reason,
    profileType: params.profileType ?? null,
    featureKey: params.featureKey,
    pricingUrl: `/pricing?profile=${profileSlug}`,
    message:
      params.message ??
      "Your organization's subscription does not permit this action.",
  };
}

@Injectable()
export class UsageCounterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly entitlementResolver: EntitlementResolverService,
  ) {}

  async isEnforcementActive(): Promise<boolean> {
    const [subEnabled, enfEnabled] = await Promise.all([
      this.featureFlagService.isEnabled('SUBSCRIPTIONS_ENABLED'),
      this.featureFlagService.isEnabled('SUBSCRIPTION_ENFORCEMENT_ENABLED'),
    ]);
    return subEnabled && enfEnabled;
  }

  /**
   * Initializes the counter row if missing, acquires a FOR UPDATE lock,
   * checks quota (if enforcement active and limitValue !== null), and increments atomically.
   */
  async consumeQuotaInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      featureKey: string;
      limitValue?: number | null;
      enforce?: boolean;
      delta?: number;
      profileType?: SubscriptionProfileType;
    },
  ): Promise<{ currentCount: number }> {
    const delta = params.delta ?? 1;

    await tx.$executeRaw`
      INSERT INTO "SubscriptionUsageCounter" ("id", "organizationId", "featureKey", "currentCount", "updatedAt")
      VALUES (gen_random_uuid(), ${params.organizationId}, ${params.featureKey}, 0, NOW())
      ON CONFLICT ("organizationId", "featureKey") DO NOTHING
    `;

    const rows = await tx.$queryRaw<Array<{ currentCount: number }>>`
      SELECT "currentCount"
      FROM "SubscriptionUsageCounter"
      WHERE "organizationId" = ${params.organizationId}
        AND "featureKey" = ${params.featureKey}
      FOR UPDATE
    `;

    const currentCount = rows[0]?.currentCount ?? 0;

    if (
      params.enforce &&
      params.limitValue !== null &&
      params.limitValue !== undefined &&
      currentCount + delta > params.limitValue
    ) {
      throw new ForbiddenException(
        buildSubscriptionRequiredPayload({
          reason: 'USAGE_LIMIT_EXCEEDED',
          profileType: params.profileType,
          featureKey: params.featureKey,
          message: `Usage limit (${params.limitValue}) exceeded for ${params.featureKey}.`,
        }),
      );
    }

    const updated = await tx.subscriptionUsageCounter.update({
      where: {
        organizationId_featureKey: {
          organizationId: params.organizationId,
          featureKey: params.featureKey,
        },
      },
      data: {
        currentCount: currentCount + delta,
      },
    });

    return { currentCount: updated.currentCount };
  }

  /**
   * High-level helper for business services: resolves entitlement if enforcement is active,
   * then atomically checks and increments the counter inside the same transaction.
   */
  async enforceAndIncrementInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    featureKey: string,
    delta = 1,
  ): Promise<void> {
    const enforce = await this.isEnforcementActive();
    let limitValue: number | null = null;
    let profileType: SubscriptionProfileType | undefined;

    if (enforce) {
      const resolved =
        await this.entitlementResolver.resolveForOrganization(organizationId);
      profileType = resolved.profileType;
      const entry = resolved.entitlements[featureKey];
      if (!entry || !entry.enabled) {
        throw new ForbiddenException(
          buildSubscriptionRequiredPayload({
            reason: 'FEATURE_NOT_INCLUDED',
            profileType,
            featureKey,
          }),
        );
      }
      limitValue = entry.unlimited ? null : entry.limitValue;
    }

    await this.consumeQuotaInTransaction(tx, {
      organizationId,
      featureKey,
      limitValue,
      enforce,
      delta,
      profileType,
    });
  }

  async decrementCounterInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    featureKey: string,
    delta = 1,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO "SubscriptionUsageCounter" ("id", "organizationId", "featureKey", "currentCount", "updatedAt")
      VALUES (gen_random_uuid(), ${organizationId}, ${featureKey}, 0, NOW())
      ON CONFLICT ("organizationId", "featureKey") DO NOTHING
    `;

    await tx.$executeRaw`
      UPDATE "SubscriptionUsageCounter"
      SET "currentCount" = GREATEST(0, "currentCount" - ${delta}),
          "updatedAt" = NOW()
      WHERE "organizationId" = ${organizationId}
        AND "featureKey" = ${featureKey}
    `;
  }

  async checkQuotaAvailable(
    organizationId: string,
    featureKey: string,
    limitValue: number | null,
  ): Promise<boolean> {
    if (limitValue === null) return true;
    const counter = await this.prisma.subscriptionUsageCounter.findUnique({
      where: {
        organizationId_featureKey: { organizationId, featureKey },
      },
      select: { currentCount: true },
    });
    const currentCount = counter?.currentCount ?? 0;
    return currentCount + 1 <= limitValue;
  }

  async reconcileOrganizationCounters(organizationId: string) {
    const [
      propertiesCount,
      roomsCount,
      staffCount,
      branchesCount,
      productsCount,
      terminalsCount,
      servicesCount,
    ] = await Promise.all([
      this.prisma.property.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.room.count({
        where: {
          deletedAt: null,
          roomType: { property: { organizationId, deletedAt: null } },
        },
      }),
      this.prisma.orgStaff.count({
        where: {
          organizationId,
          deletedAt: null,
          user: { deletedAt: null, accountStatus: { not: 'DEACTIVATED' } },
        },
      }),
      this.prisma.retailBranch.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.product.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.posTerminal.count({
        where: { branch: { organizationId } },
      }),
      this.prisma.businessService.count({
        where: { organizationId, isActive: true, deletedAt: null },
      }),
    ]);

    const counts: Record<string, number> = {
      ACCOMMODATION_LISTINGS: propertiesCount,
      ACCOMMODATION_ROOMS: roomsCount,
      AGENCY_TEAM_MEMBERS: staffCount,
      RETAIL_EMPLOYEES: staffCount,
      APPOINTMENT_STAFF: staffCount,
      RETAIL_BRANCHES: branchesCount,
      RETAIL_PRODUCTS: productsCount,
      RETAIL_POS_TERMINALS: terminalsCount,
      APPOINTMENT_SERVICES: servicesCount,
    };

    const now = new Date();
    await Promise.all(
      Object.entries(counts).map(([featureKey, currentCount]) =>
        this.prisma.subscriptionUsageCounter.upsert({
          where: {
            organizationId_featureKey: { organizationId, featureKey },
          },
          update: { currentCount, lastReconciledAt: now },
          create: {
            organizationId,
            featureKey,
            currentCount,
            lastReconciledAt: now,
          },
        }),
      ),
    );

    return counts;
  }
}
