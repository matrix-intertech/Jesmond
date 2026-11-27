import {
  BusinessCategory,
  BusinessVerificationStatus,
  OrgStatus,
  OrgType,
  Prisma,
  PrismaClient,
  SubscriptionActorType,
  SubscriptionBillingInterval,
  SubscriptionProfileType,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';

const BLOCKING_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.GRACE_PERIOD,
  SubscriptionStatus.SUSPENDED,
];

function resolveProfileType(org: {
  type: OrgType;
  businessCategory: BusinessCategory | null;
}): SubscriptionProfileType | null {
  if (org.type === OrgType.UNIVERSITY) return null;
  if (org.type === OrgType.PROVIDER || org.type === OrgType.AGENCY) {
    return SubscriptionProfileType.ACCOMMODATION;
  }
  if (org.type === OrgType.RETAIL && org.businessCategory) {
    return SubscriptionProfileType[org.businessCategory];
  }
  return null;
}

export interface BackfillReport {
  executedAt: string;
  dryRun: boolean;
  totalEligibleChecked: number;
  provisionedCount: number;
  skippedExistingCount: number;
  skippedIneligibleCount: number;
  failedCount: number;
  entries: Array<{
    organizationId: string;
    organizationName: string;
    profileType?: SubscriptionProfileType;
    outcome:
      | 'PROVISIONED'
      | 'SKIPPED_EXISTING'
      | 'SKIPPED_INELIGIBLE'
      | 'FAILED_MISSING_PLAN'
      | 'FAILED_ERROR';
    reason?: string;
    subscriptionId?: string;
  }>;
}

export async function runFreeSubscriptionBackfill(
  prisma: PrismaClient,
  options: { dryRun?: boolean; actorId?: string } = {},
): Promise<BackfillReport> {
  const dryRun = options.dryRun ?? false;
  const actorId = options.actorId ?? 'backfill-free-subscriptions';

  const organizations = await prisma.organization.findMany({
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
    },
    select: {
      id: true,
      name: true,
      type: true,
      businessCategory: true,
      subscriptions: {
        where: { status: { in: BLOCKING_STATUSES } },
        select: { id: true, status: true, source: true },
        take: 1,
      },
    },
  });

  const freePlans = await prisma.subscriptionPlan.findMany({
    where: { isFree: true, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { featureLimits: { include: { feature: true } } },
  });

  const freePlanByProfile = new Map(
    freePlans.map((plan) => [plan.profileType, plan]),
  );

  const report: BackfillReport = {
    executedAt: new Date().toISOString(),
    dryRun,
    totalEligibleChecked: organizations.length,
    provisionedCount: 0,
    skippedExistingCount: 0,
    skippedIneligibleCount: 0,
    failedCount: 0,
    entries: [],
  };

  for (const org of organizations) {
    const profileType = resolveProfileType(org);
    if (!profileType) {
      report.skippedIneligibleCount++;
      report.entries.push({
        organizationId: org.id,
        organizationName: org.name,
        outcome: 'SKIPPED_INELIGIBLE',
        reason: 'UNSUPPORTED_OR_EXCLUDED_PROFILE',
      });
      continue;
    }

    if (org.subscriptions.length > 0) {
      const existing = org.subscriptions[0];
      report.skippedExistingCount++;
      report.entries.push({
        organizationId: org.id,
        organizationName: org.name,
        profileType,
        outcome: 'SKIPPED_EXISTING',
        subscriptionId: existing.id,
        reason: `EXISTING_${existing.status}_${existing.source}`,
      });
      continue;
    }

    const freePlan = freePlanByProfile.get(profileType);
    if (!freePlan) {
      report.failedCount++;
      report.entries.push({
        organizationId: org.id,
        organizationName: org.name,
        profileType,
        outcome: 'FAILED_MISSING_PLAN',
        reason: `MISSING_FREE_PLAN_${profileType}`,
      });
      continue;
    }

    if (dryRun) {
      report.provisionedCount++;
      report.entries.push({
        organizationId: org.id,
        organizationName: org.name,
        profileType,
        outcome: 'PROVISIONED',
        reason: 'DRY_RUN',
      });
      continue;
    }

    try {
      const now = new Date();
      const resolvedEntitlements = freePlan.featureLimits.reduce<
        Record<string, { enabled: boolean; limitValue: number | null }>
      >((acc, l) => {
        if (l.planVersion === freePlan.planVersion) {
          acc[l.feature.key] = { enabled: l.enabled, limitValue: l.limitValue };
        }
        return acc;
      }, {});

      const subId = await prisma.$transaction(async (tx) => {
        const sub = await tx.organizationSubscription.create({
          data: {
            organizationId: org.id,
            planId: freePlan.id,
            planVersion: freePlan.planVersion,
            profileType,
            status: SubscriptionStatus.ACTIVE,
            billingInterval: SubscriptionBillingInterval.FREE,
            source: SubscriptionSource.FREE_AUTO,
            startsAt: now,
            currentPeriodStart: now,
            assignedByUserId: actorId,
            notes: 'Idempotent existing-organization Free-plan backfill',
          },
        });

        const snap = await tx.subscriptionEntitlementSnapshot.create({
          data: {
            subscriptionId: sub.id,
            organizationId: org.id,
            version: 1,
            effectiveFrom: now,
            planId: freePlan.id,
            planVersion: freePlan.planVersion,
            planSnapshot: {
              id: freePlan.id,
              code: freePlan.code,
              name: freePlan.name,
              profileType: freePlan.profileType,
              tier: freePlan.tier,
              planVersion: freePlan.planVersion,
              isFree: true,
            } as Prisma.InputJsonValue,
            overridesSnapshot: [] as Prisma.InputJsonValue,
            resolvedEntitlements: resolvedEntitlements as Prisma.InputJsonValue,
            actorId,
            actorType: SubscriptionActorType.SYSTEM,
            reason: 'Backfill Free-plan provisioning',
          },
        });

        await tx.organizationSubscription.update({
          where: { id: sub.id },
          data: { currentSnapshotId: snap.id },
        });

        await tx.subscriptionAuditEvent.create({
          data: {
            organizationId: org.id,
            subscriptionId: sub.id,
            actorId,
            actorType: SubscriptionActorType.SYSTEM,
            action: 'FREE_PLAN_BACKFILLED',
            afterState: {
              planCode: freePlan.code,
              profileType,
              snapshotVersion: 1,
            } as Prisma.InputJsonValue,
            reason: 'Existing verified organization backfill',
          },
        });

        return sub.id;
      });

      report.provisionedCount++;
      report.entries.push({
        organizationId: org.id,
        organizationName: org.name,
        profileType,
        outcome: 'PROVISIONED',
        subscriptionId: subId,
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        report.skippedExistingCount++;
        report.entries.push({
          organizationId: org.id,
          organizationName: org.name,
          profileType,
          outcome: 'SKIPPED_EXISTING',
          reason: 'CONCURRENT_PROVISIONING_DEDUPLICATED',
        });
      } else {
        report.failedCount++;
        report.entries.push({
          organizationId: org.id,
          organizationName: org.name,
          profileType,
          outcome: 'FAILED_ERROR',
          reason: err?.message || 'Unexpected error',
        });
      }
    }
  }

  return report;
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaClient();
  runFreeSubscriptionBackfill(prisma, { dryRun })
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((err) => {
      console.error('Backfill failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
