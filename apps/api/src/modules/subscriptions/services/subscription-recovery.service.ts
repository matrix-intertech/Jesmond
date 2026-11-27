import { Injectable } from '@nestjs/common';
import {
  BusinessVerificationStatus,
  OrgStatus,
  OrgType,
  SubscriptionActorType,
  SubscriptionProfileType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileTypeResolverService } from './profile-type-resolver.service';
import {
  BLOCKING_SUBSCRIPTION_STATUSES,
  ProvisioningResult,
  SubscriptionProvisioningService,
} from './subscription-provisioning.service';

export interface RecoveryDiagnosisItem {
  organizationId: string;
  organizationName: string;
  category:
    | 'ELIGIBLE_WITHOUT_SUBSCRIPTION'
    | 'PREVIOUS_PROVISIONING_FAILED'
    | 'UNSUPPORTED_OR_MISSING_PROFILE'
    | 'MISSING_FREE_PLAN';
  profileType?: SubscriptionProfileType;
  detail: string;
}

export interface RecoveryReport {
  dryRun: boolean;
  totalIdentified: number;
  provisioned: number;
  skipped: number;
  failed: number;
  diagnosed: RecoveryDiagnosisItem[];
  results: ProvisioningResult[];
}

@Injectable()
export class SubscriptionRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileResolver: ProfileTypeResolverService,
    private readonly provisioningService: SubscriptionProvisioningService,
  ) {}

  async diagnoseUnprovisionedOrganizations(): Promise<RecoveryDiagnosisItem[]> {
    const candidates = await this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        type: { not: OrgType.UNIVERSITY },
        status: { notIn: [OrgStatus.SUSPENDED, OrgStatus.REJECTED] },
        OR: [
          { status: OrgStatus.VERIFIED },
          {
            profileCompletion: {
              overallStatus: BusinessVerificationStatus.VERIFIED,
            },
          },
        ],
        subscriptions: {
          none: {
            status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
          },
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        businessCategory: true,
        subscriptionAuditEvents: {
          where: {
            action: { startsWith: 'PROVISIONING_FAILED_' },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { action: true, reason: true },
        },
      },
    });

    const activeFreePlans = await this.prisma.subscriptionPlan.findMany({
      where: { isFree: true, isActive: true },
      select: { profileType: true },
    });
    const availableProfiles = new Set(activeFreePlans.map((p) => p.profileType));

    return candidates.map((org) => {
      const resolved = this.profileResolver.resolve(org);
      const lastFailure = org.subscriptionAuditEvents[0];

      if (!resolved.eligible) {
        return {
          organizationId: org.id,
          organizationName: org.name,
          category: 'UNSUPPORTED_OR_MISSING_PROFILE',
          detail: resolved.reason,
        };
      }

      if (!availableProfiles.has(resolved.profileType)) {
        return {
          organizationId: org.id,
          organizationName: org.name,
          category: 'MISSING_FREE_PLAN',
          profileType: resolved.profileType,
          detail: `No active Free plan configured for ${resolved.profileType}`,
        };
      }

      if (lastFailure) {
        return {
          organizationId: org.id,
          organizationName: org.name,
          category: 'PREVIOUS_PROVISIONING_FAILED',
          profileType: resolved.profileType,
          detail: `${lastFailure.action}: ${lastFailure.reason ?? 'unknown'}`,
        };
      }

      return {
        organizationId: org.id,
        organizationName: org.name,
        category: 'ELIGIBLE_WITHOUT_SUBSCRIPTION',
        profileType: resolved.profileType,
        detail: `Verified ${resolved.profileType} organization missing Free subscription`,
      };
    });
  }

  async recoverMissingSubscriptions(options?: {
    dryRun?: boolean;
    actorId?: string;
  }): Promise<RecoveryReport> {
    const dryRun = options?.dryRun ?? false;
    const diagnosed = await this.diagnoseUnprovisionedOrganizations();
    const results: ProvisioningResult[] = [];

    if (!dryRun) {
      for (const item of diagnosed) {
        const res =
          await this.provisioningService.provisionFreePlanForOrganization(
            item.organizationId,
            {
              actorId: options?.actorId ?? 'system-recovery',
              actorType: SubscriptionActorType.SYSTEM,
              reason: `Subscription recovery (${item.category})`,
            },
          );
        results.push(res);
      }
    }

    return {
      dryRun,
      totalIdentified: diagnosed.length,
      provisioned: results.filter((r) => r.status === 'PROVISIONED').length,
      skipped: results.filter(
        (r) =>
          r.status === 'SKIPPED_EXISTING' || r.status === 'SKIPPED_INELIGIBLE',
      ).length,
      failed: results.filter(
        (r) => r.status === 'FAILED_MISSING_PLAN' || r.status === 'FAILED_ERROR',
      ).length,
      diagnosed,
      results,
    };
  }
}
