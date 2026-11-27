"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { buildAuthHeaders, clearAuth, hasBrowserAuth } from "@/utils/auth";
import { getApiUrl, handleApiError } from "@/utils/api";

export default function AdminEnterpriseSubscriptionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [orgId, setOrgId] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [featureKey, setFeatureKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [limitValue, setLimitValue] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!hasBrowserAuth()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${getApiUrl()}/api/v1/admin/subscriptions/enterprise`,
        { headers: buildAuthHeaders() },
      );
      const st = await handleApiError(res, () => {
        clearAuth();
        router.replace("/login");
      });
      if (st === "forbidden") {
        setError("Missing SUBSCRIPTION_ENTERPRISE_MANAGE permission.");
        return;
      }
      if (res.ok) setItems(await res.json());
    } catch (e: any) {
      setError(e?.message || "Failed to load enterprise contracts");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !subscriptionId || !featureKey || !reason.trim()) return;
    const res = await fetch(
      `${getApiUrl()}/api/v1/admin/subscriptions/enterprise/${orgId}/overrides`,
      {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          subscriptionId,
          featureKey: featureKey.trim(),
          enabled,
          limitValue: limitValue.trim() === "" ? null : Number(limitValue),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          reason: reason.trim(),
        }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || "Failed to save override");
      return;
    }
    setReason("");
    setFeatureKey("");
    setLimitValue("");
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Enterprise Plans</h1>
        <p className="text-sm text-text-secondary mt-1">
          Organization-level Enterprise contracts, custom overrides, and immutable entitlement snapshots.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSaveOverride}
        className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-3"
      >
        <h2 className="font-semibold text-primary">
          Apply Organization Entitlement Override
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            required
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="Organization ID"
            className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          />
          <input
            required
            value={subscriptionId}
            onChange={(e) => setSubscriptionId(e.target.value)}
            placeholder="Subscription ID"
            className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          />
          <input
            required
            value={featureKey}
            onChange={(e) => setFeatureKey(e.target.value)}
            placeholder="Feature Key (e.g. ACCOMMODATION_LISTINGS)"
            className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          />
          <input
            type="number"
            min={0}
            value={limitValue}
            onChange={(e) => setLimitValue(e.target.value)}
            placeholder="Numeric limit (blank = unlimited)"
            className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          />
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          />
          <input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Mandatory audit reason"
            className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Feature enabled
        </label>
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium"
        >
          Save Override & Create Snapshot
        </button>
      </form>

      <div className="space-y-4">
        {loading ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            Loading Enterprise contracts...
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-secondary bg-surface border border-border-subtle rounded-2xl">
            No Enterprise subscriptions assigned yet.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-2"
            >
              <div className="flex justify-between items-center">
                <div className="font-semibold text-primary">
                  {item.organization?.name} ({item.profileType})
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-muted">
                  {item.status}
                </span>
              </div>
              <div className="text-xs text-text-secondary">
                Org ID: {item.organizationId} · Sub ID: {item.id}
              </div>
              <div className="text-xs text-text-secondary">
                Overrides:{" "}
                {item.overrides?.length
                  ? item.overrides
                      .map(
                        (ov: any) =>
                          `${ov.feature?.key}=${ov.enabled ? (ov.limitValue ?? "Unlimited") : "Disabled"}`,
                      )
                      .join(", ")
                  : "None"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
