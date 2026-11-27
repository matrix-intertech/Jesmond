"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "@/utils/api";
import { buildAuthHeaders, hasBrowserAuth } from "@/utils/auth";
import {
  CurrentSubscriptionSummary,
  OrganizationEntitlementsResponse,
} from "@/utils/subscriptions";

export function BusinessSubscriptionPanel() {
  const [loading, setLoading] = useState(true);
  const [disabledNotice, setDisabledNotice] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState("");
  const [subscription, setSubscription] =
    useState<CurrentSubscriptionSummary | null>(null);
  const [entitlements, setEntitlements] =
    useState<OrganizationEntitlementsResponse | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!hasBrowserAuth()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setDisabledNotice(false);
      setUnavailableReason("");
      try {
        const [subRes, entRes] = await Promise.all([
          fetch(`${getApiUrl()}/api/v1/subscriptions/current`, {
            headers: buildAuthHeaders(),
            cache: "no-store",
          }),
          fetch(`${getApiUrl()}/api/v1/subscriptions/current/entitlements`, {
            headers: buildAuthHeaders(),
            cache: "no-store",
          }),
        ]);

        if (!active) return;

        if (subRes.status === 503) {
          const body = await subRes.json().catch((): null => null);
          if (body?.code === "SUBSCRIPTIONS_DISABLED") {
            setDisabledNotice(true);
            return;
          }
        }

        if (!subRes.ok || !entRes.ok) {
          const body = await subRes.json().catch((): null => null);
          setUnavailableReason(
            body?.message ||
              "Subscription details are not currently available for this organization.",
          );
          return;
        }

        setSubscription(await subRes.json());
        setEntitlements(await entRes.json());
      } catch (e: any) {
        if (!active) return;
        setUnavailableReason(
          e?.message || "Unable to load organization subscription details.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Loading organization subscription...
      </div>
    );
  }

  if (disabledNotice) {
    return (
      <div
        className="bg-surface border border-border-subtle rounded-2xl p-6 space-y-2"
        data-testid="subscription-disabled-panel"
      >
        <h2 className="text-lg font-semibold text-primary">
          Organization Subscription
        </h2>
        <p className="text-sm text-text-secondary">
          Subscription management is currently disabled on this platform. All authorized organization workflows continue using standard role permissions.
        </p>
      </div>
    );
  }

  if (unavailableReason || !subscription) {
    return (
      <div
        className="bg-surface border border-border-subtle rounded-2xl p-6 space-y-2"
        data-testid="subscription-unavailable-panel"
      >
        <h2 className="text-lg font-semibold text-primary">
          Organization Subscription
        </h2>
        <p className="text-sm text-text-secondary">
          {unavailableReason ||
            "No active subscription record is available for this organization."}
        </p>
      </div>
    );
  }

  const entries = Object.values(entitlements?.entitlements || {});

  return (
    <div className="space-y-6" data-testid="business-subscription-panel">
      <div className="bg-surface border border-border-subtle rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-primary">
              {subscription.plan.name}
            </h2>
            <p className="text-xs text-text-secondary">
              Profile: {subscription.profileType} · Tier:{" "}
              {subscription.plan.tier} · Billing:{" "}
              {subscription.billingInterval}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-muted text-primary">
            {subscription.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-border-subtle">
          <div>
            <div className="text-text-secondary">Current Period Start</div>
            <div className="font-medium text-primary mt-0.5">
              {new Date(subscription.currentPeriodStart).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-text-secondary">Renewal / Period End</div>
            <div className="font-medium text-primary mt-0.5">
              {subscription.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                : "No expiry (Free plan)"}
            </div>
          </div>
          <div>
            <div className="text-text-secondary">Cancellation / Grace</div>
            <div className="font-medium text-primary mt-0.5">
              {subscription.inGracePeriod && subscription.graceEndsAt
                ? `Grace until ${new Date(subscription.graceEndsAt).toLocaleDateString()}`
                : subscription.cancelAtPeriodEnd
                  ? "Scheduled at period end"
                  : "Active"}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primary">
            Plan Entitlements &amp; Usage
          </h3>
          {entitlements?.snapshotVersion && (
            <span className="text-xs text-text-secondary">
              Snapshot v{entitlements.snapshotVersion}
            </span>
          )}
        </div>
        {entries.length === 0 ? (
          <div className="p-6 text-sm text-text-secondary">
            No feature entitlements configured for this profile.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-subtle text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Usage / Limit</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {entries.map((entry) => (
                <tr key={entry.featureKey}>
                  <td className="px-4 py-3 font-mono text-xs text-primary">
                    {entry.featureKey}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {entry.enabled ? "Enabled" : "Disabled"}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-primary">
                    {!entry.enabled
                      ? "—"
                      : entry.unlimited
                        ? "Unlimited"
                        : entry.limitValue !== null
                          ? `${entry.currentUsage ?? 0} / ${entry.limitValue}`
                          : "Included"}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {entry.source === "ORGANIZATION_OVERRIDE"
                      ? `Enterprise Override${
                          entry.overrideExpiresAt
                            ? ` (until ${new Date(entry.overrideExpiresAt).toLocaleDateString()})`
                            : ""
                        }`
                      : "Plan"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
