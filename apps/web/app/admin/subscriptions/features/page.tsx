"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildAuthHeaders, clearAuth, hasBrowserAuth } from "@/utils/auth";
import { getApiUrl, handleApiError } from "@/utils/api";

export default function AdminSubscriptionFeaturesPage() {
  const router = useRouter();
  const [switches, setSwitches] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!hasBrowserAuth()) return;
    setLoading(true);
    setError("");
    try {
      const [swRes, ftRes, rdRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/v1/admin/subscriptions/switches`, {
          headers: buildAuthHeaders(),
        }),
        fetch(`${getApiUrl()}/api/v1/admin/subscriptions/features`, {
          headers: buildAuthHeaders(),
        }),
        fetch(`${getApiUrl()}/api/v1/admin/subscriptions/billing-readiness`, {
          headers: buildAuthHeaders(),
        }),
      ]);
      const st = await handleApiError(ftRes, () => {
        clearAuth();
        router.replace("/login");
      });
      if (st === "forbidden") {
        setError("Missing subscription feature management permissions.");
        return;
      }
      if (swRes.ok) setSwitches(await swRes.json());
      if (ftRes.ok) setFeatures(await ftRes.json());
      if (rdRes.ok) setReadiness(await rdRes.json());
    } catch (e: any) {
      setError(e?.message || "Failed to load feature controls");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSwitch = async (key: string, currentEnabled: boolean) => {
    if (
      !window.confirm(
        `Are you sure you want to ${currentEnabled ? "disable" : "enable"} ${key}?`,
      )
    ) {
      return;
    }
    const res = await fetch(
      `${getApiUrl()}/api/v1/admin/subscriptions/switches/${key}`,
      {
        method: "PATCH",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ enabled: !currentEnabled }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || "Failed to update switch");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Feature Controls</h1>
        <p className="text-sm text-text-secondary mt-1">
          Global subscription switches and canonical subscription feature catalog.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {readiness && (
        <div
          className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-3"
          data-testid="stripe-billing-readiness"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-primary">
                Stripe Checkout Readiness
              </h2>
              <p className="text-xs text-text-secondary">
                Controlled by the existing{" "}
                <span className="font-mono">{readiness.stripeSwitchKey}</span>{" "}
                switch in{" "}
                <Link
                  href="/admin/settings/features"
                  className="text-accent underline"
                >
                  Admin Feature Flags
                </Link>
                .
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-muted text-primary">
              {readiness.checkoutReady ? "Checkout Ready" : "Checkout Unavailable"}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-surface-muted">
              Stripe Switch ({readiness.stripeSwitchKey}):{" "}
              <strong>{readiness.stripeSwitchEnabled ? "ON" : "OFF"}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-muted">
              API Key:{" "}
              <strong>
                {readiness.stripeApiKeyConfigured ? "Configured" : "Missing"}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-muted">
              Webhook Secret:{" "}
              <strong>
                {readiness.stripeWebhookConfigured ? "Configured" : "Missing"}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-muted">
              Checkout Switch:{" "}
              <strong>{readiness.checkoutEnabled ? "ON" : "OFF"}</strong>
            </div>
          </div>
          {readiness.reasons?.length > 0 && (
            <div className="text-xs text-text-secondary">
              <strong>Unavailable reasons:</strong>{" "}
              {readiness.reasons.join(" · ")}
            </div>
          )}
        </div>
      )}

      <div className="bg-surface border border-border-subtle rounded-2xl divide-y divide-border-subtle">
        <div className="px-5 py-4 font-semibold text-primary">
          Global Subscription Switches
        </div>
        {switches.map((sw) => (
          <div
            key={sw.key}
            className="px-5 py-4 flex items-center justify-between"
          >
            <div>
              <div className="text-sm font-medium text-primary">{sw.key}</div>
              <div className="text-xs text-text-secondary">
                {sw.enabled ? "Enabled" : "Disabled"}
              </div>
            </div>
            <button
              onClick={() => toggleSwitch(sw.key, sw.enabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                sw.enabled
                  ? "bg-accent text-white"
                  : "bg-surface-muted text-primary border border-border-strong"
              }`}
            >
              {sw.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden">
        <div className="px-5 py-4 font-semibold text-primary border-b border-border-subtle">
          Feature Catalog ({features.length})
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            Loading feature catalog...
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border-subtle text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Profiles</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {features.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3 font-mono text-xs">{f.key}</td>
                  <td className="px-4 py-3 font-medium text-primary">
                    {f.name}
                  </td>
                  <td className="px-4 py-3 text-xs">{f.valueType}</td>
                  <td className="px-4 py-3 text-xs">
                    {(f.applicableProfiles || []).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {f.isActive ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
