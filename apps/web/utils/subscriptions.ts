export type SubscriptionProfileType =
  | "ACCOMMODATION"
  | "RETAIL"
  | "FOOD"
  | "MECHANICS"
  | "SERVICES"
  | "RENTALS";

export const SUBSCRIPTION_PROFILES: Array<{
  id: SubscriptionProfileType;
  label: string;
}> = [
  { id: "ACCOMMODATION", label: "Accommodation" },
  { id: "RETAIL", label: "Retail" },
  { id: "FOOD", label: "Food" },
  { id: "MECHANICS", label: "Mechanics" },
  { id: "SERVICES", label: "Services" },
  { id: "RENTALS", label: "Rentals" },
];

export interface PublicPlanPrice {
  id: string;
  interval: "FREE" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "CUSTOM";
  unitAmountMinor: number;
  currency: string;
  currencyDecimals: number;
  taxBehavior: string;
}

export interface PublicPlanFeature {
  key: string;
  name: string;
  description: string | null;
  valueType: "BOOLEAN" | "NUMERIC_LIMIT";
  enabled: boolean;
  limitValue: number | null;
  unlimited: boolean;
}

export interface PublicPlan {
  id: string;
  profileType: SubscriptionProfileType;
  code: string;
  name: string;
  description: string | null;
  tier: "FREE" | "STANDARD" | "PRO" | "ENTERPRISE";
  isFree: boolean;
  isEnterprise: boolean;
  prices: PublicPlanPrice[];
  features: PublicPlanFeature[];
}

export interface PublicPricingResponse {
  subscriptionsEnabled: boolean;
  checkoutEnabled: boolean;
  plans: PublicPlan[];
}

export interface CurrentSubscriptionSummary {
  subscriptionId: string;
  organizationId: string;
  profileType: SubscriptionProfileType;
  status: string;
  effectiveAccessActive: boolean;
  inGracePeriod: boolean;
  billingInterval: string;
  source: string;
  cancelAtPeriodEnd: boolean;
  startsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  canceledAt: string | null;
  suspendedAt: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    tier: string;
    planVersion: number;
    isFree: boolean;
    isEnterprise: boolean;
  };
  snapshotId: string | null;
}

export interface EntitlementEntry {
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  currentUsage?: number | null;
  unlimited: boolean;
  source: "PLAN" | "ORGANIZATION_OVERRIDE";
  overrideExpiresAt: string | null;
}

export interface OrganizationEntitlementsResponse {
  organizationId: string;
  subscriptionId: string;
  profileType: SubscriptionProfileType;
  planId: string;
  planCode: string;
  planVersion: number;
  subscriptionStatus: string;
  effectiveAccessActive: boolean;
  effectiveAt: string;
  graceEndsAt: string | null;
  snapshotId: string | null;
  snapshotVersion: number | null;
  entitlements: Record<string, EntitlementEntry>;
}

export interface SubscriptionRequiredDetail {
  statusCode: number;
  code: "SUBSCRIPTION_REQUIRED";
  reason:
    | "NO_ACTIVE_SUBSCRIPTION"
    | "FEATURE_NOT_INCLUDED"
    | "USAGE_LIMIT_EXCEEDED"
    | "SUBSCRIPTION_EXPIRED"
    | "SUBSCRIPTION_SUSPENDED";
  profileType?: SubscriptionProfileType | null;
  featureKey: string;
  pricingUrl?: string;
  message?: string;
}

export const SUBSCRIPTION_REQUIRED_EVENT = "jesmond:subscription-required";

export function emitSubscriptionRequired(detail: SubscriptionRequiredDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SubscriptionRequiredDetail>(SUBSCRIPTION_REQUIRED_EVENT, {
      detail,
    }),
  );
}

export function formatPriceMinor(
  unitAmountMinor: number,
  currency: string,
  decimals = 2,
): string {
  const divisor = Math.pow(10, decimals);
  const value = unitAmountMinor / divisor;
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      minimumFractionDigits: value % 1 === 0 ? 0 : decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(decimals)}`;
  }
}
