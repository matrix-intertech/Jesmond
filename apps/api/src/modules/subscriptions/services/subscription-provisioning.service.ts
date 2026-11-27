import { Injectable, Logger } from '@nestjs/common';
import {
  BusinessVerificationStatus,
  OrgStatus,
  Prisma,
  SubscriptionActorType,
  SubscriptionBillingInterval,
  SubscriptionProfileType,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileTypeResolverService } from './profile-type-resolver.service';

export const BLOCKING_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.GRACE_PERIOD,
  SubscriptionStatus.SUSPENDED,
];

export type ProvisioningOutcomeStatus =
  | 'PROVISIONED'
  | 'SKIPPED_EXISTING'
  | 'SKIPPED_INELIGIBLE'
  | 'FAILED_MISSING_PLAN'
  | 'FAILED_ERROR';

export interface ProvisioningResult {
  organizationId: string;
  status: ProvisioningOutcomeStatus;
  profileType?: SubscriptionProfileType;
  subscriptionId?: string;
  planId?: string;
  planCode?: string;
  reason?: string;
}

export interface ProvisioningOptions {
  actorId?: string;
  actorType?: SubscriptionActorType;
  reason?: string;
}

@Injectable()
export class SubscriptionProvisioningService {
  private readonly logger = new Logger(SubscriptionProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profileResolver: ProfileTypeResolverService,
  ) {}

  async provisionFreePlanForOrganization(
    organizationId: string,
    options: ProvisioningOptions = {},
  ): Promise<ProvisioningResult> {
    const actorType = options.actorType ?? SubscriptionActorType.SYSTEM;
    const actorId = options.actorId ?? 'system';
    const reason = options.reason ?? 'Automated Free-plan provisioning';

    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          type: true,
          status: true,
          businessCategory: true,
          deletedAt: true,
          profileCompletion: {
            select: { overallStatus: true },
          },
        },
      });

      if (!org || org.deletedAt) {
        return {
          organizationId,
          status: 'SKIPPED_INELIGIBLE',
          reason: 'ORGANIZATION_NOT_FOUND_OR_DELETED',
        };
      }

      if (
        org.status === OrgStatus.SUSPENDED ||
        org.status === OrgStatus.REJECTED
      ) {
        return {
          organizationId,
          status: 'SKIPPED_INELIGIBLE',
          reason: `ORGANIZATION_STATUS_${org.status}`,
        };
      }

      const isVerified =
        org.status === OrgStatus.VERIFIED ||
        org.profileCompletion?.overallStatus ===
          BusinessVerificationStatus.VERIFIED;

      if (!isVerified) {
        return {
          organizationId,
          status: 'SKIPPED_INELIGIBLE',
          reason: 'ORGANIZATION_NOT_VERIFIED',
        };
      }

      const profileResolution = this.profileResolver.resolve(org);
      if (!profileResolution.eligible) {
        if (profileResolution.reason !== 'EXCLUDED_UNIVERSITY') {
          await this.recordFailureAudit(
            organizationId,
            'PROVISIONING_FAILED_UNSUPPORTED_PROFILE',
            actorId,
            actorType,
            profileResolution.reason,
          );
        }
        return {
          organizationId,
          status: 'SKIPPED_INELIGIBLE',
          reason: profileResolution.reason,
        };
      }

      const { profileType } = profileResolution;

      // Never overwrite any active, trialing, past-due, grace, or suspended subscription
      const existing = await this.prisma.organizationSubscription.findFirst({
        where: {
          organizationId,
          status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
        },
        select: { id: true, status: true, source: true },
      });

      if (existing) {
        return {
          organizationId,
          status: 'SKIPPED_EXISTING',
          profileType,
          subscriptionId: existing.id,
          reason: `EXISTING_${existing.status}_${existing.source}`,
        };
      }

      const freePlan = await this.prisma.subscriptionPlan.findFirst({
        where: {
          profileType,
          isFree: true,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          featureLimits: {
            include: { feature: true },
          },
        },
      });

      if (!freePlan) {
        await this.recordFailureAudit(
          organizationId,
          'PROVISIONING_FAILED_MISSING_FREE_PLAN',
          actorId,
          actorType,
          `No active Free plan found for profile ${profileType}`,
        );
        return {
          organizationId,
          status: 'FAILED_MISSING_PLAN',
          profileType,
          reason: `MISSING_FREE_PLAN_${profileType}`,
        };
      }

      const planSnapshot = {
        id: freePlan.id,
        code: freePlan.code,
        name: freePlan.name,
        profileType: freePlan.profileType,
        tier: freePlan.tier,
        planVersion: freePlan.planVersion,
        isFree: freePlan.isFree,
      };

      const resolvedEntitlements = freePlan.featureLimits.reduce<
        Record<string, { enabled: boolean; limitValue: number | null }>
      >((acc, limit) => {
        if (limit.planVersion === freePlan.planVersion) {
          acc[limit.feature.key] = {
            enabled: limit.enabled,
            limitValue: limit.limitValue,
          };
        }
        return acc;
      }, {});

      const now = new Date();

      const created = await this.prisma.$transaction(async (tx) => {
        const txExisting = await tx.organizationSubscription.findFirst({
          where: {
            organizationId,
            status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
          },
          select: { id: true, status: true, source: true },
        });

        if (txExisting) {
          return { skipped: true as const, existing: txExisting };
        }

        const subscription = await tx.organizationSubscription.create({
          data: {
            organizationId,
            planId: freePlan.id,
            planVersion: freePlan.planVersion,
            profileType,
            status: SubscriptionStatus.ACTIVE,
            billingInterval: SubscriptionBillingInterval.FREE,
            source: SubscriptionSource.FREE_AUTO,
            startsAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: null,
            graceEndsAt: null,
            assignedByUserId: actorId,
            notes: reason,
          },
        });

        const snapshot = await tx.subscriptionEntitlementSnapshot.create({
          data: {
            subscriptionId: subscription.id,
            organizationId,
            version: 1,
            effectiveFrom: now,
            effectiveTo: null,
            planId: freePlan.id,
            planVersion: freePlan.planVersion,
            planSnapshot: planSnapshot as Prisma.InputJsonValue,
            overridesSnapshot: [] as Prisma.InputJsonValue,
            resolvedEntitlements: resolvedEntitlements as Prisma.InputJsonValue,
            actorId,
            actorType,
            reason,
            previousSnapshotId: null,
          },
        });

        await tx.organizationSubscription.update({
          where: { id: subscription.id },
          data: { currentSnapshotId: snapshot.id },
        });

        await tx.subscriptionAuditEvent.create({
          data: {
            organizationId,
            subscriptionId: subscription.id,
            actorId,
            actorType,
            action: 'FREE_PLAN_PROVISIONED',
            beforeState: Prisma.JsonNull,
            afterState: {
              planId: freePlan.id,
              planCode: freePlan.code,
              profileType,
              status: SubscriptionStatus.ACTIVE,
              source: SubscriptionSource.FREE_AUTO,
              snapshotVersion: 1,
            } as Prisma.InputJsonValue,
            reason,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            actorType,
            action: 'subscription.free_plan.provisioned',
            resourceType: 'OrganizationSubscription',
            resourceId: subscription.id,
            changes: {
              organizationId,
              profileType,
              planCode: freePlan.code,
              source: SubscriptionSource.FREE_AUTO,
            } as Prisma.InputJsonValue,
          },
        });

        return { skipped: false as const, subscription };
      });

      if (created.skipped) {
        return {
          organizationId,
          status: 'SKIPPED_EXISTING',
          profileType,
          subscriptionId: created.existing.id,
          reason: `EXISTING_${created.existing.status}_${created.existing.source}`,
        };
      }

      return {
        organizationId,
        status: 'PROVISIONED',
        profileType,
        subscriptionId: created.subscription.id,
        planId: freePlan.id,
        planCode: freePlan.code,
      };
    } catch (error: any) {
      // Partial unique index violation under concurrent provisioning
      if (error?.code === 'P2002') {
        return {
          organizationId,
          status: 'SKIPPED_EXISTING',
          reason: 'CONCURRENT_PROVISIONING_DEDUPLICATED',
        };
      }

      this.logger.error(
        `Free-plan provisioning failed safely for organization ${organizationId}: ${error?.message || error}`,
      );

      await this.recordFailureAudit(
        organizationId,
        'PROVISIONING_FAILED_ERROR',
        actorId,
        actorType,
        error?.message || 'Unexpected provisioning error',
      ).catch(() => undefined);

      return {
        organizationId,
        status: 'FAILED_ERROR',
        reason: error?.message || 'Unexpected provisioning error',
      };
    }
  }

  private async recordFailureAudit(
    organizationId: string,
    action: string,
    actorId: string,
    actorType: SubscriptionActorType,
    reason: string,
  ): Promise<void> {
    await this.prisma.subscriptionAuditEvent.create({
      data: {
        organizationId,
        subscriptionId: null,
        actorId,
        actorType,
        action,
        beforeState: Prisma.JsonNull,
        afterState: Prisma.JsonNull,
        reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType,
        action: `subscription.provisioning.${action.toLowerCase()}`,
        resourceType: 'Organization',
        resourceId: organizationId,
        changes: { reason } as Prisma.InputJsonValue,
      },
    });
  }
}
