import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  SubscriptionActorType,
  SubscriptionEntitlementSnapshot,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SubscriptionDomainException,
  SubscriptionErrorCode,
} from '../errors/subscription-domain.error';

export interface CreateSnapshotParams {
  subscriptionId: string;
  organizationId: string;
  actorId?: string;
  actorType?: SubscriptionActorType;
  reason: string;
  effectiveAt?: Date;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class EntitlementSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async createEntitlementSnapshot(
    params: CreateSnapshotParams,
  ): Promise<SubscriptionEntitlementSnapshot> {
    const run = async (
      tx: Prisma.TransactionClient,
    ): Promise<SubscriptionEntitlementSnapshot> => {
      const now = params.effectiveAt ?? new Date();

      // Serialize concurrent snapshot mutations per subscription row
      await tx.$queryRaw`
        SELECT id FROM "OrganizationSubscription"
        WHERE id = ${params.subscriptionId}
        FOR UPDATE
      `;

      const subscription = await tx.organizationSubscription.findUnique({
        where: { id: params.subscriptionId },
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

      if (!subscription) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
          `Subscription ${params.subscriptionId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      if (subscription.organizationId !== params.organizationId) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.CROSS_ORGANIZATION_ACCESS_DENIED,
          'Subscription does not belong to the specified organization',
          HttpStatus.FORBIDDEN,
        );
      }

      const previousSnapshot =
        await tx.subscriptionEntitlementSnapshot.findFirst({
          where: { subscriptionId: subscription.id },
          orderBy: { version: 'desc' },
        });

      const activeOverrides =
        await tx.organizationEntitlementOverride.findMany({
          where: {
            subscriptionId: subscription.id,
            organizationId: subscription.organizationId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          include: { feature: true },
        });

      const resolvedEntitlements: Record<
        string,
        {
          enabled: boolean;
          limitValue: number | null;
          source: 'PLAN' | 'ORGANIZATION_OVERRIDE';
          overrideExpiresAt: string | null;
        }
      > = {};

      for (const limit of subscription.plan.featureLimits) {
        if (
          limit.planVersion === subscription.planVersion &&
          limit.feature.isActive &&
          limit.feature.applicableProfiles.includes(subscription.profileType)
        ) {
          resolvedEntitlements[limit.feature.key] = {
            enabled: limit.enabled,
            limitValue: limit.limitValue,
            source: 'PLAN',
            overrideExpiresAt: null,
          };
        }
      }

      const overridesSnapshot: Array<{
        id: string;
        featureId: string;
        featureKey: string;
        enabled: boolean;
        limitValue: number | null;
        expiresAt: string | null;
        reason: string;
      }> = [];

      for (const ov of activeOverrides) {
        if (
          !ov.feature.isActive ||
          !ov.feature.applicableProfiles.includes(subscription.profileType)
        ) {
          continue;
        }

        overridesSnapshot.push({
          id: ov.id,
          featureId: ov.featureId,
          featureKey: ov.feature.key,
          enabled: ov.enabled,
          limitValue: ov.limitValue,
          expiresAt: ov.expiresAt ? ov.expiresAt.toISOString() : null,
          reason: ov.reason,
        });

        resolvedEntitlements[ov.feature.key] = {
          enabled: ov.enabled,
          limitValue: ov.limitValue,
          source: 'ORGANIZATION_OVERRIDE',
          overrideExpiresAt: ov.expiresAt ? ov.expiresAt.toISOString() : null,
        };
      }

      const planSnapshot = {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
        profileType: subscription.plan.profileType,
        tier: subscription.plan.tier,
        planVersion: subscription.planVersion,
        isFree: subscription.plan.isFree,
        isEnterprise: subscription.plan.isEnterprise,
      };

      const nextVersion = (previousSnapshot?.version ?? 0) + 1;
      const actorId = params.actorId ?? 'system';
      const actorType = params.actorType ?? SubscriptionActorType.SYSTEM;

      // Append-only: never mutate previous snapshots
      const snapshot = await tx.subscriptionEntitlementSnapshot.create({
        data: {
          subscriptionId: subscription.id,
          organizationId: subscription.organizationId,
          version: nextVersion,
          effectiveFrom: now,
          effectiveTo: null,
          planId: subscription.plan.id,
          planVersion: subscription.planVersion,
          planSnapshot: planSnapshot as Prisma.InputJsonValue,
          overridesSnapshot: overridesSnapshot as Prisma.InputJsonValue,
          resolvedEntitlements: resolvedEntitlements as Prisma.InputJsonValue,
          actorId,
          actorType,
          reason: params.reason,
          previousSnapshotId: previousSnapshot?.id ?? null,
        },
      });

      await tx.organizationSubscription.update({
        where: { id: subscription.id },
        data: { currentSnapshotId: snapshot.id },
      });

      await tx.subscriptionAuditEvent.create({
        data: {
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          actorId,
          actorType,
          action: 'ENTITLEMENT_SNAPSHOT_CREATED',
          beforeState: previousSnapshot
            ? ({
                snapshotId: previousSnapshot.id,
                version: previousSnapshot.version,
              } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          afterState: {
            snapshotId: snapshot.id,
            version: snapshot.version,
          } as Prisma.InputJsonValue,
          reason: params.reason,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          actorType,
          action: 'subscription.entitlement_snapshot.created',
          resourceType: 'SubscriptionEntitlementSnapshot',
          resourceId: snapshot.id,
          changes: {
            organizationId: subscription.organizationId,
            subscriptionId: subscription.id,
            version: snapshot.version,
            previousSnapshotId: previousSnapshot?.id ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      return snapshot;
    };

    if (params.tx) {
      return run(params.tx);
    }

    return this.prisma.$transaction((tx) => run(tx));
  }

  /**
   * Resolves the immutable snapshot applicable at a given point in time
   * using effectiveFrom <= at ordered by version DESC (no historical row updates).
   */
  async getSnapshotAtTimestamp(
    subscriptionId: string,
    organizationId: string,
    at: Date,
  ): Promise<SubscriptionEntitlementSnapshot | null> {
    return this.prisma.subscriptionEntitlementSnapshot.findFirst({
      where: {
        subscriptionId,
        organizationId,
        effectiveFrom: { lte: at },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    });
  }
}
