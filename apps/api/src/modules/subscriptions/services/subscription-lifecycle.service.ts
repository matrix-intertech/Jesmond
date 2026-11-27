import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  OrganizationSubscription,
  Prisma,
  SubscriptionActorType,
  SubscriptionBillingInterval,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SubscriptionDomainException,
  SubscriptionErrorCode,
} from '../errors/subscription-domain.error';
import { EntitlementSnapshotService } from './entitlement-snapshot.service';
import { ProfileTypeResolverService } from './profile-type-resolver.service';
import { BLOCKING_SUBSCRIPTION_STATUSES } from './subscription-provisioning.service';
import { SubscriptionStatusService } from './subscription-status.service';

export interface LifecycleActor {
  actorId: string;
  actorType?: SubscriptionActorType;
  reason?: string;
}

const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  [SubscriptionStatus.TRIALING]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.GRACE_PERIOD,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.SUSPENDED,
  ],
  [SubscriptionStatus.ACTIVE]: [
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.GRACE_PERIOD,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.SUSPENDED,
  ],
  [SubscriptionStatus.PAST_DUE]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.GRACE_PERIOD,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.SUSPENDED,
  ],
  [SubscriptionStatus.GRACE_PERIOD]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.SUSPENDED,
  ],
  [SubscriptionStatus.SUSPENDED]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.GRACE_PERIOD,
    SubscriptionStatus.CANCELED,
  ],
  [SubscriptionStatus.EXPIRED]: [],
  [SubscriptionStatus.CANCELED]: [],
};

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statusService: SubscriptionStatusService,
    private readonly snapshotService: EntitlementSnapshotService,
    private readonly profileResolver: ProfileTypeResolverService,
  ) {}

  private assertTransitionAllowed(
    from: SubscriptionStatus,
    to: SubscriptionStatus,
  ) {
    if (from === to) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
        `Subscription is already in ${to} status`,
        HttpStatus.CONFLICT,
      );
    }
    if (!VALID_TRANSITIONS[from]?.includes(to)) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
        `Invalid subscription transition from ${from} to ${to}`,
        HttpStatus.CONFLICT,
        { from, to },
      );
    }
  }

  private async lockAndValidateSubscription(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    organizationId: string,
  ) {
    await tx.$queryRaw`
      SELECT id FROM "OrganizationSubscription"
      WHERE id = ${subscriptionId}
      FOR UPDATE
    `;

    const sub = await tx.organizationSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!sub) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
        `Subscription ${subscriptionId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (sub.organizationId !== organizationId) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.CROSS_ORGANIZATION_ACCESS_DENIED,
        'Subscription does not belong to the specified organization',
        HttpStatus.FORBIDDEN,
      );
    }

    return sub;
  }

  private async writeTransitionAudit(
    tx: Prisma.TransactionClient,
    sub: OrganizationSubscription,
    action: string,
    beforeStatus: SubscriptionStatus,
    afterStatus: SubscriptionStatus,
    actor: LifecycleActor,
    extraAfter?: Record<string, unknown>,
  ) {
    const actorType = actor.actorType ?? SubscriptionActorType.USER;
    await tx.subscriptionAuditEvent.create({
      data: {
        organizationId: sub.organizationId,
        subscriptionId: sub.id,
        actorId: actor.actorId,
        actorType,
        action,
        beforeState: { status: beforeStatus } as Prisma.InputJsonValue,
        afterState: {
          status: afterStatus,
          ...(extraAfter ?? {}),
        } as Prisma.InputJsonValue,
        reason: actor.reason ?? action,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.actorId,
        actorType,
        action: `subscription.lifecycle.${action.toLowerCase()}`,
        resourceType: 'OrganizationSubscription',
        resourceId: sub.id,
        changes: {
          organizationId: sub.organizationId,
          fromStatus: beforeStatus,
          toStatus: afterStatus,
          ...(extraAfter ?? {}),
        } as Prisma.InputJsonValue,
      },
    });
  }

  async activateSubscription(
    subscriptionId: string,
    organizationId: string,
    actor: LifecycleActor,
    period?: { currentPeriodStart: Date; currentPeriodEnd: Date | null },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lockAndValidateSubscription(
        tx,
        subscriptionId,
        organizationId,
      );
      this.assertTransitionAllowed(sub.status, SubscriptionStatus.ACTIVE);

      const updated = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          graceEndsAt: null,
          ...(period
            ? {
                currentPeriodStart: period.currentPeriodStart,
                currentPeriodEnd: period.currentPeriodEnd,
              }
            : {}),
        },
      });

      await this.writeTransitionAudit(
        tx,
        updated,
        'SUBSCRIPTION_ACTIVATED',
        sub.status,
        SubscriptionStatus.ACTIVE,
        actor,
      );

      return updated;
    });
  }

  async markPastDue(
    subscriptionId: string,
    organizationId: string,
    actor: LifecycleActor,
    now: Date = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lockAndValidateSubscription(
        tx,
        subscriptionId,
        organizationId,
      );

      if (
        sub.billingInterval === SubscriptionBillingInterval.FREE ||
        sub.plan.isFree
      ) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          'Free subscriptions cannot be marked past due',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.assertTransitionAllowed(sub.status, SubscriptionStatus.PAST_DUE);

      const graceBase = sub.currentPeriodEnd ?? now;
      const graceEndsAt = this.statusService.computeGraceEndsAt(graceBase);

      const updated = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          graceEndsAt,
        },
      });

      await this.writeTransitionAudit(
        tx,
        updated,
        'SUBSCRIPTION_MARKED_PAST_DUE',
        sub.status,
        SubscriptionStatus.PAST_DUE,
        actor,
        { graceEndsAt: graceEndsAt.toISOString() },
      );

      return updated;
    });
  }

  async enterGracePeriod(
    subscriptionId: string,
    organizationId: string,
    actor: LifecycleActor,
    now: Date = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lockAndValidateSubscription(
        tx,
        subscriptionId,
        organizationId,
      );

      if (
        sub.billingInterval === SubscriptionBillingInterval.FREE ||
        sub.plan.isFree
      ) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          'Free subscriptions cannot enter grace period',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.assertTransitionAllowed(sub.status, SubscriptionStatus.GRACE_PERIOD);

      const graceBase = sub.currentPeriodEnd ?? now;
      const graceEndsAt =
        sub.graceEndsAt ?? this.statusService.computeGraceEndsAt(graceBase);

      const updated = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.GRACE_PERIOD,
          graceEndsAt,
        },
      });

      await this.writeTransitionAudit(
        tx,
        updated,
        'SUBSCRIPTION_ENTERED_GRACE_PERIOD',
        sub.status,
        SubscriptionStatus.GRACE_PERIOD,
        actor,
        { graceEndsAt: graceEndsAt.toISOString() },
      );

      return updated;
    });
  }

  async renewSubscription(
    subscriptionId: string,
    organizationId: string,
    newPeriodStart: Date,
    newPeriodEnd: Date,
    actor: LifecycleActor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lockAndValidateSubscription(
        tx,
        subscriptionId,
        organizationId,
      );

      if (
        sub.status !== SubscriptionStatus.ACTIVE &&
        sub.status !== SubscriptionStatus.PAST_DUE &&
        sub.status !== SubscriptionStatus.GRACE_PERIOD
      ) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          `Cannot renew subscription from ${sub.status} status`,
          HttpStatus.CONFLICT,
        );
      }

      const updated = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
          graceEndsAt: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });

      await this.writeTransitionAudit(
        tx,
        updated,
        'SUBSCRIPTION_RENEWED',
        sub.status,
        SubscriptionStatus.ACTIVE,
        actor,
        {
          currentPeriodStart: newPeriodStart.toISOString(),
          currentPeriodEnd: newPeriodEnd.toISOString(),
        },
      );

      await this.snapshotService.createEntitlementSnapshot({
        subscriptionId: updated.id,
        organizationId: updated.organizationId,
        actorId: actor.actorId,
        actorType: actor.actorType ?? SubscriptionActorType.SYSTEM,
        reason: actor.reason ?? 'Subscription renewed',
        tx,
      });

      return updated;
    });
  }

  async expireSubscription(
    subscriptionId: string,
    organizationId: string,
    actor: LifecycleActor,
    options?: { now?: Date; force?: boolean },
  ) {
    const now = options?.now ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lockAndValidateSubscription(
        tx,
        subscriptionId,
        organizationId,
      );

      if (
        (sub.billingInterval === SubscriptionBillingInterval.FREE ||
          sub.plan.isFree) &&
        sub.currentPeriodEnd === null
      ) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          'Free subscriptions with no expiry date cannot be expired',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.assertTransitionAllowed(sub.status, SubscriptionStatus.EXPIRED);

      if (
        !options?.force &&
        sub.status === SubscriptionStatus.GRACE_PERIOD &&
        this.statusService.isGraceActive(sub.graceEndsAt, now)
      ) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          'Cannot expire subscription while 7-day grace period is still active',
          HttpStatus.CONFLICT,
          { graceEndsAt: sub.graceEndsAt },
        );
      }

      // Enterprise contracts transition to EXPIRED and NEVER silently downgrade to Free
      const updated = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.EXPIRED,
        },
      });

      await this.writeTransitionAudit(
        tx,
        updated,
        'SUBSCRIPTION_EXPIRED',
        sub.status,
        SubscriptionStatus.EXPIRED,
        actor,
        {
          isEnterprise:
            sub.plan.isEnterprise ||
            sub.source === SubscriptionSource.ENTERPRISE_CONTRACT,
        },
      );

      return updated;
    });
  }

  async cancelImmediately(
    subscriptionId: string,
    organizationId: string,
    actor: LifecycleActor,
    now: Date = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lockAndValidateSubscription(
        tx,
        subscriptionId,
        organizationId,
      );
      this.assertTransitionAllowed(sub.status, SubscriptionStatus.CANCELED);

      const updated = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: false,
          canceledAt: now,
        },
      });

      await this.writeTransitionAudit(
        tx,
        updated,
        'SUBSCRIPTION_CANCELED_IMMEDIATELY',
        sub.status,
        SubscriptionStatus.CANCELED,
        actor,
        { canceledAt: now.toISOString() },
      );

      return updated;
    });
  }

  async scheduleCancellationAtPeriodEnd(
    subscriptionId: string,
    organizationId: string,
    actor: LifecycleActor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lockAndValidateSubscription(
        tx,
        subscriptionId,
        organizationId,
      );

      if (
        sub.status !== SubscriptionStatus.ACTIVE &&
        sub.status !== SubscriptionStatus.TRIALING
      ) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          `Cannot schedule end-of-period cancellation from ${sub.status}`,
          HttpStatus.CONFLICT,
        );
      }

      if (!sub.currentPeriodEnd) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          'Cannot schedule period-end cancellation on subscription without currentPeriodEnd',
          HttpStatus.BAD_REQUEST,
        );
      }

      const updated = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          cancelAtPeriodEnd: true,
        },
      });

      await this.writeTransitionAudit(
        tx,
        updated,
        'SUBSCRIPTION_CANCEL_SCHEDULED',
        sub.status,
        sub.status,
        actor,
        {
          cancelAtPeriodEnd: true,
          effectiveCancellationAt: sub.currentPeriodEnd.toISOString(),
        },
      );

      return updated;
    });
  }

  async completeScheduledCancellation(
    subscriptionId: string,
    organizationId: string,
    actor: LifecycleActor,
    now: Date = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lockAndValidateSubscription(
        tx,
        subscriptionId,
        organizationId,
      );

      if (!sub.cancelAtPeriodEnd || !sub.currentPeriodEnd) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          'Subscription does not have a scheduled period-end cancellation',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (now.getTime() < sub.currentPeriodEnd.getTime()) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          'Current billing period has not ended yet',
          HttpStatus.CONFLICT,
        );
      }

      this.assertTransitionAllowed(sub.status, SubscriptionStatus.CANCELED);

      const updated = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.CANCELED,
          canceledAt: sub.currentPeriodEnd,
        },
      });

      await this.writeTransitionAudit(
        tx,
        updated,
        'SUBSCRIPTION_SCHEDULED_CANCEL_COMPLETED',
        sub.status,
        SubscriptionStatus.CANCELED,
        actor,
        { canceledAt: sub.currentPeriodEnd.toISOString() },
      );

      return updated;
    });
  }

  async suspendSubscription(
    subscriptionId: string,
    organizationId: string,
    actor: LifecycleActor,
    now: Date = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lockAndValidateSubscription(
        tx,
        subscriptionId,
        organizationId,
      );
      this.assertTransitionAllowed(sub.status, SubscriptionStatus.SUSPENDED);

      const updated = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.SUSPENDED,
          suspendedAt: now,
        },
      });

      await this.writeTransitionAudit(
        tx,
        updated,
        'SUBSCRIPTION_SUSPENDED',
        sub.status,
        SubscriptionStatus.SUSPENDED,
        actor,
        { suspendedAt: now.toISOString() },
      );

      return updated;
    });
  }

  async reactivateSubscription(
    subscriptionId: string,
    organizationId: string,
    actor: LifecycleActor,
    now: Date = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lockAndValidateSubscription(
        tx,
        subscriptionId,
        organizationId,
      );

      if (sub.status !== SubscriptionStatus.SUSPENDED) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          `Only SUSPENDED subscriptions can be reactivated (current: ${sub.status})`,
          HttpStatus.CONFLICT,
        );
      }

      let targetStatus: SubscriptionStatus = SubscriptionStatus.ACTIVE;
      if (
        sub.currentPeriodEnd &&
        now.getTime() >= sub.currentPeriodEnd.getTime()
      ) {
        if (this.statusService.isGraceActive(sub.graceEndsAt, now)) {
          targetStatus = SubscriptionStatus.GRACE_PERIOD;
        } else {
          throw new SubscriptionDomainException(
            SubscriptionErrorCode.SUBSCRIPTION_EXPIRED,
            'Cannot reactivate an expired billing period without renewal or replacement',
            HttpStatus.CONFLICT,
          );
        }
      }

      const updated = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: targetStatus,
          suspendedAt: null,
        },
      });

      await this.writeTransitionAudit(
        tx,
        updated,
        'SUBSCRIPTION_REACTIVATED',
        sub.status,
        targetStatus,
        actor,
      );

      return updated;
    });
  }

  async replaceSubscription(params: {
    organizationId: string;
    newPlanId: string;
    planPriceId?: string | null;
    billingInterval: SubscriptionBillingInterval;
    source: SubscriptionSource;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date | null;
    enterpriseBillingDetails?: Prisma.InputJsonValue;
    actor: LifecycleActor;
  }) {
    const now = params.currentPeriodStart ?? new Date();
    const actorType = params.actor.actorType ?? SubscriptionActorType.USER;

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: params.organizationId },
        select: { id: true, type: true, businessCategory: true, deletedAt: true },
      });
      if (!org || org.deletedAt) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
          'Organization not found or deleted',
          HttpStatus.NOT_FOUND,
        );
      }

      const resolved = this.profileResolver.resolve(org);
      if (!resolved.eligible) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.PROFILE_MISMATCH,
          `Organization profile ineligible (${resolved.reason})`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: params.newPlanId },
      });
      if (!plan || !plan.isActive) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          'Target subscription plan not found or inactive',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (plan.profileType !== resolved.profileType) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.PROFILE_MISMATCH,
          `Plan profile ${plan.profileType} does not match organization profile ${resolved.profileType}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const current = await tx.organizationSubscription.findFirst({
        where: {
          organizationId: org.id,
          status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
        },
      });

      if (current) {
        await tx.$queryRaw`
          SELECT id FROM "OrganizationSubscription"
          WHERE id = ${current.id}
          FOR UPDATE
        `;

        await tx.organizationSubscription.update({
          where: { id: current.id },
          data: {
            status: SubscriptionStatus.CANCELED,
            canceledAt: now,
            cancelAtPeriodEnd: false,
          },
        });
      }

      const created = await tx.organizationSubscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          planVersion: plan.planVersion,
          planPriceId: params.planPriceId ?? null,
          profileType: resolved.profileType,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: params.billingInterval,
          source: params.source,
          startsAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: params.currentPeriodEnd ?? null,
          graceEndsAt: null,
          enterpriseBillingDetails: params.enterpriseBillingDetails,
          assignedByUserId: params.actor.actorId,
          notes: params.actor.reason ?? 'Subscription replaced',
        },
      });

      if (current) {
        await tx.organizationSubscription.update({
          where: { id: current.id },
          data: {
            replacedBySubscriptionId: created.id,
          },
        });

        await this.writeTransitionAudit(
          tx,
          current,
          'SUBSCRIPTION_REPLACED',
          current.status,
          SubscriptionStatus.CANCELED,
          params.actor,
          { replacedBySubscriptionId: created.id },
        );
      }

      const snapshot = await this.snapshotService.createEntitlementSnapshot({
        subscriptionId: created.id,
        organizationId: org.id,
        actorId: params.actor.actorId,
        actorType,
        reason: params.actor.reason ?? `Assigned plan ${plan.code}`,
        effectiveAt: now,
        tx,
      });

      return { subscription: created, snapshot, replacedId: current?.id ?? null };
    });
  }

  /**
   * Idempotent batch lifecycle sweep designed for future Cron invocation.
   * Uses conditional transitions; never expires Free plans; never downgrades Enterprise.
   */
  async processDueLifecycleTransitions(now: Date = new Date()) {
    const actor: LifecycleActor = {
      actorId: 'system-lifecycle',
      actorType: SubscriptionActorType.SYSTEM,
      reason: 'Scheduled lifecycle transition sweep',
    };

    let enteredGrace = 0;
    let expired = 0;
    let canceledScheduled = 0;

    // 1. Scheduled period-end cancellations
    const dueCancels = await this.prisma.organizationSubscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
        cancelAtPeriodEnd: true,
        currentPeriodEnd: { lte: now },
      },
      select: { id: true, organizationId: true },
    });

    for (const sub of dueCancels) {
      try {
        await this.completeScheduledCancellation(
          sub.id,
          sub.organizationId,
          actor,
          now,
        );
        canceledScheduled++;
      } catch (e: any) {
        this.logger.warn(`Scheduled cancel skipped for ${sub.id}: ${e?.message}`);
      }
    }

    // 2. Paid ACTIVE subscriptions past currentPeriodEnd -> GRACE_PERIOD
    const dueGrace = await this.prisma.organizationSubscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
        billingInterval: { not: SubscriptionBillingInterval.FREE },
        currentPeriodEnd: { lte: now },
      },
      select: { id: true, organizationId: true },
    });

    for (const sub of dueGrace) {
      try {
        await this.enterGracePeriod(sub.id, sub.organizationId, actor, now);
        enteredGrace++;
      } catch (e: any) {
        this.logger.warn(`Grace transition skipped for ${sub.id}: ${e?.message}`);
      }
    }

    // 3. GRACE_PERIOD / PAST_DUE subscriptions past graceEndsAt -> EXPIRED
    const dueExpiry = await this.prisma.organizationSubscription.findMany({
      where: {
        status: {
          in: [SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.PAST_DUE],
        },
        billingInterval: { not: SubscriptionBillingInterval.FREE },
        graceEndsAt: { lte: now },
      },
      select: { id: true, organizationId: true },
    });

    for (const sub of dueExpiry) {
      try {
        await this.expireSubscription(sub.id, sub.organizationId, actor, { now });
        expired++;
      } catch (e: any) {
        this.logger.warn(`Expiry skipped for ${sub.id}: ${e?.message}`);
      }
    }

    return { enteredGrace, expired, canceledScheduled };
  }
}
