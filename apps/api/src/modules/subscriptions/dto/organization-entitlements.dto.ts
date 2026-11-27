import { SubscriptionProfileType, SubscriptionStatus } from '@prisma/client';

export type EntitlementSource = 'PLAN' | 'ORGANIZATION_OVERRIDE';

export class EntitlementEntryDto {
  featureKey!: string;
  enabled!: boolean;
  limitValue!: number | null;
  currentUsage?: number | null;
  unlimited!: boolean;
  source!: EntitlementSource;
  overrideExpiresAt!: Date | null;
}

export class OrganizationEntitlementsDto {
  organizationId!: string;
  subscriptionId!: string;
  profileType!: SubscriptionProfileType;
  planId!: string;
  planCode!: string;
  planVersion!: number;
  subscriptionStatus!: SubscriptionStatus;
  effectiveAccessActive!: boolean;
  effectiveAt!: Date;
  graceEndsAt!: Date | null;
  snapshotId!: string | null;
  snapshotVersion!: number | null;
  entitlements!: Record<string, EntitlementEntryDto>;
}
