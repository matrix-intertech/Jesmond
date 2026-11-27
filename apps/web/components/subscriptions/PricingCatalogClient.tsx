"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getApiUrl } from "@/utils/api";
import {
  PublicPlan,
  SUBSCRIPTION_PROFILES,
  SubscriptionProfileType,
  formatPriceMinor,
} from "@/utils/subscriptions";

export function PricingCatalogClient() {
  const searchParams = useSearchParams();
  const initialProfile = useMemo(() => {
    const raw = searchParams?.get("profile")?.toUpperCase();
    const match = SUBSCRIPTION_PROFILES.find((p) => p.id === raw);
    return match ? match.id : "ACCOMMODATION";
  }, [searchParams]);

  const [profile, setProfile] =
    useState<SubscriptionProfileType>(initialProfile);
  const [interval, setInterval] = useState<"MONTHLY" | "QUARTERLY" | "ANNUAL">(
    "MONTHLY",
  );
  const [currency, setCurrency] = useState<string>("AUD");
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(
      `${getApiUrl()}/api/v1/subscriptions/public/pricing?profile=${profile}`,
      { cache: "no-store" },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to load pricing information.");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setEnabled(Boolean(data?.subscriptionsEnabled));
        setPlans(Array.isArray(data?.plans) ? data.plans : []);
      })
      .catch((e: any) => {
        if (!active) return;
        setError(e?.message || "Unable to load pricing information.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profile]);

  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const plan of plans) {
      for (const price of plan.prices) {
        set.add(price.currency);
      }
    }
    return Array.from(set);
  }, [plans]);

  useEffect(() => {
    if (
      availableCurrencies.length > 0 &&
      !availableCurrencies.includes(currency)
    ) {
      setCurrency(availableCurrencies[0]);
    }
  }, [availableCurrencies, currency]);

  if (loading) {
    return (
      <div
        className="max-w-[1100px] mx-auto px-6 py-16 text-center text-text-secondary"
        data-testid="pricing-loading"
      >
        Loading pricing...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[700px] mx-auto px-6 py-16 text-center">
        <div className="rounded-2xl border border-border-strong bg-surface p-8 text-sm text-text-secondary">
          {error}
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <section
        className="max-w-[760px] mx-auto px-6 -mt-10 relative z-20"
        data-testid="pricing-unavailable-notice"
      >
        <div className="bg-surface rounded-[24px] p-10 border border-border-strong shadow-sm text-center space-y-3">
          <h2 className="text-2xl font-bold text-primary">
            Pricing &amp; Plans Unavailable
          </h2>
          <p className="text-sm text-text-secondary max-w-lg mx-auto">
            Subscription plans and public pricing are currently unavailable. Please contact our support team for organization onboarding assistance.
          </p>
          <div className="pt-2">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#EA8A32] via-[#D6A64F] to-[#F3D69A] text-[#120D09] text-sm font-bold hover:brightness-105 transition"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1100px] mx-auto px-6 -mt-10 relative z-20 space-y-8">
      <div className="bg-surface rounded-2xl p-4 border border-border-strong shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Business profile types"
        >
          {SUBSCRIPTION_PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={profile === p.id}
              onClick={() => setProfile(p.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                profile === p.id
                  ? "bg-accent text-white"
                  : "bg-surface-muted text-primary hover:bg-border-subtle"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Billing interval"
            value={interval}
            onChange={(e) => setInterval(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-xs font-medium text-primary"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly (Save 5%)</option>
            <option value="ANNUAL">Annual (Save 15%)</option>
          </select>
          {availableCurrencies.length > 0 && (
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-xs font-medium text-primary"
            >
              {availableCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="bg-surface rounded-2xl p-10 border border-border-strong text-center text-sm text-text-secondary">
          No public plans are currently published for{" "}
          {SUBSCRIPTION_PROFILES.find((p) => p.id === profile)?.label || profile}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const matchedPrice =
              plan.prices.find(
                (pr) => pr.interval === interval && pr.currency === currency,
              ) ||
              plan.prices.find((pr) => pr.currency === currency) ||
              plan.prices[0];

            return (
              <div
                key={plan.id}
                data-testid={`pricing-plan-${plan.code}`}
                className="bg-surface rounded-[24px] p-8 border border-border-strong shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-primary">{plan.name}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-surface-muted text-text-secondary">
                    {plan.tier}
                  </span>
                </div>
                {plan.description && (
                  <p className="text-text-secondary text-sm mb-6">
                    {plan.description}
                  </p>
                )}

                <div className="mb-6">
                  {plan.isFree ? (
                    <>
                      <span className="text-4xl font-bold text-primary">
                        Free
                      </span>
                      <span className="text-text-muted text-sm ml-2">
                        Starter plan
                      </span>
                    </>
                  ) : plan.isEnterprise || !matchedPrice ? (
                    <>
                      <span className="text-4xl font-bold text-primary">
                        Custom
                      </span>
                      <span className="text-text-muted text-sm ml-2">
                        Tailored contract
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-primary">
                        {formatPriceMinor(
                          matchedPrice.unitAmountMinor,
                          matchedPrice.currency,
                          matchedPrice.currencyDecimals,
                        )}
                      </span>
                      <span className="text-text-muted text-sm ml-2">
                        / {matchedPrice.interval.toLowerCase()}
                      </span>
                      {matchedPrice.interval === "QUARTERLY" && (
                        <div className="mt-1 inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#24160D] border border-[rgba(214,166,79,0.3)] text-[#F3D69A]">
                          5% quarterly discount applied
                        </div>
                      )}
                      {matchedPrice.interval === "ANNUAL" && (
                        <div className="mt-1 inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#24160D] border border-[rgba(214,166,79,0.3)] text-[#F3D69A]">
                          15% annual discount applied
                        </div>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-3 text-sm text-text-secondary mb-8 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat.key} className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 font-bold ${
                          feat.enabled ? "text-[#EA8A32]" : "text-text-muted"
                        }`}
                      >
                        {feat.enabled ? "✓" : "—"}
                      </span>
                      <span>
                        {feat.name}
                        {feat.valueType === "NUMERIC_LIMIT" && feat.enabled && (
                          <span className="font-semibold text-primary ml-1">
                            ({feat.unlimited ? "Unlimited" : `Up to ${feat.limitValue}`})
                          </span>
                        )}
                        {!feat.enabled && (
                          <span className="text-xs text-text-muted ml-1">
                            (Not included)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {plan.isFree ? (
                  <Link
                    href="/business/register"
                    className="w-full py-3 rounded-xl border border-border-strong text-primary font-medium text-center hover:bg-surface-muted transition"
                  >
                    Get Started Free
                  </Link>
                ) : (
                  <Link
                    href="/contact"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#EA8A32] via-[#D6A64F] to-[#F3D69A] text-[#120D09] font-bold text-center hover:brightness-105 transition"
                  >
                    Contact Sales
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
