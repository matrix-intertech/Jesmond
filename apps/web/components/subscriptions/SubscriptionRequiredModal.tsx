"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiUrl } from "@/utils/api";
import { buildAuthHeaders, hasBrowserAuth } from "@/utils/auth";
import {
  CurrentSubscriptionSummary,
  OrganizationEntitlementsResponse,
  SUBSCRIPTION_REQUIRED_EVENT,
  SubscriptionRequiredDetail,
} from "@/utils/subscriptions";

const REASON_LABELS: Record<SubscriptionRequiredDetail["reason"], string> = {
  NO_ACTIVE_SUBSCRIPTION: "No active subscription found for your organization.",
  FEATURE_NOT_INCLUDED: "This feature is not included in your current plan.",
  USAGE_LIMIT_EXCEEDED: "Your organization has reached its plan usage limit for this feature.",
  SUBSCRIPTION_EXPIRED: "Your organization's subscription has expired.",
  SUBSCRIPTION_SUSPENDED: "Your organization's subscription is currently suspended.",
};

export function SubscriptionRequiredModal() {
  const [detail, setDetail] = useState<SubscriptionRequiredDetail | null>(null);
  const [pricingEnabled, setPricingEnabled] = useState(false);
  const [currentSub, setCurrentSub] =
    useState<CurrentSubscriptionSummary | null>(null);
  const [entitlements, setEntitlements] =
    useState<OrganizationEntitlementsResponse | null>(null);

  useEffect(() => {
    const handler = async (e: Event) => {
      const custom = e as CustomEvent<SubscriptionRequiredDetail>;
      if (!custom.detail) return;
      setDetail(custom.detail);
      setPricingEnabled(false);
      setCurrentSub(null);
      setEntitlements(null);

      try {
        const cfgRes = await fetch(
          `${getApiUrl()}/api/v1/subscriptions/public/config`,
        );
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          const enabled = Boolean(cfg?.subscriptionsEnabled);
          setPricingEnabled(enabled);

          if (enabled && hasBrowserAuth()) {
            const [subRes, entRes] = await Promise.all([
              fetch(`${getApiUrl()}/api/v1/subscriptions/current`, {
                headers: buildAuthHeaders(),
              }),
              fetch(`${getApiUrl()}/api/v1/subscriptions/current/entitlements`, {
                headers: buildAuthHeaders(),
              }),
            ]);
            if (subRes.ok) setCurrentSub(await subRes.json());
            if (entRes.ok) setEntitlements(await entRes.json());
          }
        }
      } catch {
        // Fail closed on pricing visibility
      }
    };

    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, handler);
    return () =>
      window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, handler);
  }, []);

  if (!detail) return null;

  const featureEntry = entitlements?.entitlements?.[detail.featureKey];
  const pricingHref =
    detail.pricingUrl ||
    `/pricing?profile=${(detail.profileType || currentSub?.profileType || "accommodation").toLowerCase()}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-required-title"
      data-testid="subscription-required-modal"
    >
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border-strong bg-surface p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="subscription-required-title"
              className="text-lg font-bold text-primary"
            >
              Subscription Required
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {REASON_LABELS[detail.reason] ||
                detail.message ||
                "Your organization's subscription does not permit this action."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDetail(null)}
            aria-label="Close subscription dialog"
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-muted"
          >
            ✕
          </button>
        </div>

        <div className="rounded-xl bg-surface-muted p-4 text-xs space-y-1.5 border border-border-subtle">
          <div>
            <span className="text-text-secondary">Required Feature:</span>{" "}
            <span className="font-mono font-semibold text-primary">
              {detail.featureKey}
            </span>
          </div>
          {currentSub?.plan && (
            <div>
              <span className="text-text-secondary">Current Plan:</span>{" "}
              <span className="font-semibold text-primary">
                {currentSub.plan.name} ({currentSub.status})
              </span>
            </div>
          )}
          {featureEntry && featureEntry.limitValue !== null && (
            <div>
              <span className="text-text-secondary">Usage:</span>{" "}
              <span className="font-semibold text-primary">
                {featureEntry.currentUsage ?? 0} / {featureEntry.limitValue}
              </span>
            </div>
          )}
          {featureEntry?.unlimited && (
            <div>
              <span className="text-text-secondary">Usage:</span>{" "}
              <span className="font-semibold text-primary">Unlimited</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="px-4 py-2 rounded-xl border border-border-strong text-sm font-medium text-primary hover:bg-surface-muted"
          >
            Close
          </button>
          {pricingEnabled && (
            <Link
              href={pricingHref}
              onClick={() => setDetail(null)}
              className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90"
            >
              View Plans
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
