import { Injectable } from '@nestjs/common';
import {
  SubscriptionBillingInterval,
  SubscriptionStatus,
} from '@prisma/client';

export const GRACE_PERIOD_DAYS = 7;
export const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

export interface EvaluableSubscriptionState {
  status: SubscriptionStatus;
  billingInterval: SubscriptionBillingInterval;
  isFreePlan?: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  canceledAt: Date | null;
}

export interface EvaluatedAccessResult {
  effectiveStatus: SubscriptionStatus;
  isActive: boolean;
  inGracePeriod: boolean;
  reason?: 'EXPIRED' | 'CANCELED' | 'SUSPENDED';
}

@Injectable()
export class SubscriptionStatusService {
  computeGraceEndsAt(expiryOrOverdueAt: Date): Date {
    return new Date(expiryOrOverdueAt.getTime() + GRACE_PERIOD_MS);
  }

  /**
   * Boundary semantics:
   * - now < graceEndsAt  => grace active
   * - now >= graceEndsAt => grace expired
   */
  isGraceActive(graceEndsAt: Date | null, now: Date = new Date()): boolean {
    if (!graceEndsAt) return false;
    return now.getTime() < graceEndsAt.getTime();
  }

  evaluateAccess(
    sub: EvaluableSubscriptionState,
    now: Date = new Date(),
  ): EvaluatedAccessResult {
    const isFree =
      sub.billingInterval === SubscriptionBillingInterval.FREE ||
      sub.isFreePlan === true;

    if (sub.status === SubscriptionStatus.SUSPENDED) {
      return {
        effectiveStatus: SubscriptionStatus.SUSPENDED,
        isActive: false,
        inGracePeriod: false,
        reason: 'SUSPENDED',
      };
    }

    if (sub.status === SubscriptionStatus.EXPIRED) {
      return {
        effectiveStatus: SubscriptionStatus.EXPIRED,
        isActive: false,
        inGracePeriod: false,
        reason: 'EXPIRED',
      };
    }

    if (sub.status === SubscriptionStatus.CANCELED) {
      if (
        sub.cancelAtPeriodEnd &&
        sub.currentPeriodEnd &&
        now.getTime() < sub.currentPeriodEnd.getTime()
      ) {
        return {
          effectiveStatus: SubscriptionStatus.CANCELED,
          isActive: true,
          inGracePeriod: false,
        };
      }
      return {
        effectiveStatus: SubscriptionStatus.CANCELED,
        isActive: false,
        inGracePeriod: false,
        reason: 'CANCELED',
      };
    }

    // Free subscriptions with null currentPeriodEnd never expire
    if (isFree && sub.currentPeriodEnd === null) {
      return {
        effectiveStatus: sub.status,
        isActive: true,
        inGracePeriod: false,
      };
    }

    if (sub.status === SubscriptionStatus.GRACE_PERIOD) {
      if (this.isGraceActive(sub.graceEndsAt, now)) {
        return {
          effectiveStatus: SubscriptionStatus.GRACE_PERIOD,
          isActive: true,
          inGracePeriod: true,
        };
      }
      return {
        effectiveStatus: SubscriptionStatus.EXPIRED,
        isActive: false,
        inGracePeriod: false,
        reason: 'EXPIRED',
      };
    }

    if (sub.status === SubscriptionStatus.PAST_DUE) {
      if (this.isGraceActive(sub.graceEndsAt, now)) {
        return {
          effectiveStatus: SubscriptionStatus.PAST_DUE,
          isActive: true,
          inGracePeriod: true,
        };
      }
      // Do not unexpectedly drop access if grace window hasn't been stamped yet while period is still valid
      if (
        sub.currentPeriodEnd &&
        now.getTime() < sub.currentPeriodEnd.getTime()
      ) {
        return {
          effectiveStatus: SubscriptionStatus.PAST_DUE,
          isActive: true,
          inGracePeriod: false,
        };
      }
      return {
        effectiveStatus: SubscriptionStatus.EXPIRED,
        isActive: false,
        inGracePeriod: false,
        reason: 'EXPIRED',
      };
    }

    // TRIALING or ACTIVE
    if (
      sub.currentPeriodEnd &&
      now.getTime() >= sub.currentPeriodEnd.getTime()
    ) {
      if (sub.cancelAtPeriodEnd) {
        return {
          effectiveStatus: SubscriptionStatus.CANCELED,
          isActive: false,
          inGracePeriod: false,
          reason: 'CANCELED',
        };
      }
      if (this.isGraceActive(sub.graceEndsAt, now)) {
        return {
          effectiveStatus: SubscriptionStatus.GRACE_PERIOD,
          isActive: true,
          inGracePeriod: true,
        };
      }
      return {
        effectiveStatus: SubscriptionStatus.EXPIRED,
        isActive: false,
        inGracePeriod: false,
        reason: 'EXPIRED',
      };
    }

    return {
      effectiveStatus: sub.status,
      isActive: true,
      inGracePeriod: false,
    };
  }
}
