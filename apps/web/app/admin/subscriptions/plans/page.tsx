"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { buildAuthHeaders, clearAuth, hasBrowserAuth } from "@/utils/auth";
import { getApiUrl, handleApiError } from "@/utils/api";

const PROFILES = [
  "ACCOMMODATION",
  "RETAIL",
  "FOOD",
  "MECHANICS",
  "SERVICES",
  "RENTALS",
];

export default function AdminSubscriptionPlansPage() {
  const router = useRouter();
  const [activeProfile, setActiveProfile] = useState("ACCOMMODATION");
  const [plans, setPlans] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tier, setTier] = useState("STANDARD");

  const [pricePlanId, setPricePlanId] = useState("");
  const [interval, setInterval] = useState("MONTHLY");
  const [currency, setCurrency] = useState("AUD");
  const [amountMinor, setAmountMinor] = useState("4900");

  const load = useCallback(async () => {
    if (!hasBrowserAuth()) return;
    setLoading(true);
    setError("");
    try {
      const [plansRes, featRes] = await Promise.all([
        fetch(
          `${getApiUrl()}/api/v1/admin/subscriptions/plans?profileType=${activeProfile}`,
          { headers: buildAuthHeaders() },
        ),
        fetch(`${getApiUrl()}/api/v1/admin/subscriptions/features`, {
          headers: buildAuthHeaders(),
        }),
      ]);
      const st = await handleApiError(plansRes, () => {
        clearAuth();
        router.replace("/login");
      });
      if (st === "forbidden") {
        setError("Missing SUBSCRIPTION_PLANS_MANAGE permission.");
        return;
      }
      if (plansRes.ok) setPlans(await plansRes.json());
      if (featRes.ok) setFeatures(await featRes.json());
    } catch (e: any) {
      setError(e?.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [activeProfile, router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${getApiUrl()}/api/v1/admin/subscriptions/plans`, {
      method: "POST",
      headers: buildAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        profileType: activeProfile,
        code,
        name,
        description,
        tier,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || "Failed to create plan");
      return;
    }
    setCode("");
    setName("");
    setDescription("");
    await load();
  };

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricePlanId) return;
    const res = await fetch(
      `${getApiUrl()}/api/v1/admin/subscriptions/plans/${pricePlanId}/prices`,
      {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          interval,
          currency,
          unitAmountMinor: Number(amountMinor),
        }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || "Failed to add price");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Subscription Plans</h1>
        <p className="text-sm text-text-secondary mt-1">
          Configure profile-specific plans, multi-currency pricing versions, and versioned feature limits.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROFILES.map((p) => (
          <button
            key={p}
            onClick={() => setActiveProfile(p)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              activeProfile === p
                ? "bg-accent text-white border-accent"
                : "bg-surface border-border-strong text-primary"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleCreatePlan}
          className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-3"
        >
          <h2 className="font-semibold text-primary">
            Create {activeProfile} Plan
          </h2>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Plan code (e.g. RETAIL_PRO)"
            className="w-full px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          />
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            className="w-full px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          />
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          >
            <option value="FREE">FREE</option>
            <option value="STANDARD">STANDARD</option>
            <option value="PRO">PRO</option>
            <option value="ENTERPRISE">ENTERPRISE</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium"
          >
            Create Plan
          </button>
        </form>

        <form
          onSubmit={handleAddPrice}
          className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-3"
        >
          <h2 className="font-semibold text-primary">
            Publish New Price Version
          </h2>
          <select
            required
            value={pricePlanId}
            onChange={(e) => setPricePlanId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
          >
            <option value="">Select Plan...</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
            >
              <option value="MONTHLY">MONTHLY</option>
              <option value="QUARTERLY">QUARTERLY</option>
              <option value="ANNUAL">ANNUAL</option>
            </select>
            <input
              required
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="AUD / USD / INR / GBP"
              className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
            />
            <input
              required
              type="number"
              min={0}
              value={amountMinor}
              onChange={(e) => setAmountMinor(e.target.value)}
              placeholder="Minor units (cents)"
              className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium"
          >
            Save Price Version
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            Loading plans...
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-primary">
                    {plan.name}{" "}
                    <span className="text-xs font-normal text-text-secondary">
                      ({plan.code} · v{plan.planVersion} · {plan.tier})
                    </span>
                  </h3>
                  <p className="text-xs text-text-secondary">{plan.description}</p>
                </div>
                <div className="text-xs text-text-secondary">
                  {plan.isActive ? "Active" : "Inactive"} ·{" "}
                  {plan.isPublic ? "Public" : "Hidden"}
                </div>
              </div>
              <div className="text-xs text-text-secondary">
                <strong>Prices:</strong>{" "}
                {plan.prices?.length
                  ? plan.prices
                      .filter((pr: any) => pr.isActive)
                      .map(
                        (pr: any) =>
                          `${pr.interval} ${pr.currency} ${(pr.unitAmountMinor / 100).toFixed(2)} (v${pr.priceVersion})`,
                      )
                      .join(" | ")
                  : plan.isFree
                    ? "Free"
                    : "No active prices"}
              </div>
              <div className="text-xs text-text-secondary">
                <strong>Current Limits (v{plan.planVersion}):</strong>{" "}
                {plan.featureLimits
                  ?.filter((l: any) => l.planVersion === plan.planVersion)
                  .map(
                    (l: any) =>
                      `${l.feature?.key}: ${l.enabled ? (l.limitValue === null ? "Unlimited" : l.limitValue) : "Disabled"}`,
                  )
                  .join(" · ") || `${features.length} features available`}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
