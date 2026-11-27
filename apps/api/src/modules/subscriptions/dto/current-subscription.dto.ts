import {
  SubscriptionBillingInterval,
  SubscriptionProfileType,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';

export class CurrentSubscriptionDto {
  subscriptionId!: string;
  organizationId!: string;
  profileType!: SubscriptionProfileType;
  status!: SubscriptionStatus;
  effectiveAccessActive!: boolean;
  inGracePeriod!: boolean;
  billingInterval!: SubscriptionBillingInterval;
  source!: SubscriptionSource;
  cancelAtPeriodEnd!: boolean;
  startsAt!: Date;
  currentPeriodStart!: Date;
  currentPeriodEnd!: Date | null;
  graceEndsAt!: Date | null;
  canceledAt!: Date | null;
  suspendedAt!: Date | null;
  plan!: {
    id: string;
    code: string;
    name: string;
    tier: string;
    planVersion: number;
    isFree: boolean;
    isEnterprise: boolean;
  };
  snapshotId!: string | null;
}
