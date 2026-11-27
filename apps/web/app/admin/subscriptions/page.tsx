"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { buildAuthHeaders, clearAuth, getCurrentUser, hasBrowserAuth } from "@/utils/auth";
import { getApiUrl, handleApiError } from "@/utils/api";

const PROFILES = [
  "ACCOMMODATION",
  "RETAIL",
  "FOOD",
  "MECHANICS",
  "SERVICES",
  "RENTALS",
];

const STATUSES = [
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
  "GRACE_PERIOD",
  "EXPIRED",
  "CANCELED",
  "SUSPENDED",
];

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const [assignOrgId, setAssignOrgId] = useState<string | null>(null);
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assignInterval, setAssignInterval] = useState("MONTHLY");
  const [assignReason, setAssignReason] = useState("");
  const [replaceExplicit, setReplaceExplicit] = useState(false);

  const loadData = useCallback(async () => {
    if (!hasBrowserAuth()) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (profileFilter) qs.set("profileType", profileFilter);
      if (statusFilter) qs.set("status", statusFilter);

      const [ovRes, listRes, plansRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/v1/admin/subscriptions/overview`, {
          headers: buildAuthHeaders(),
        }),
        fetch(
          `${getApiUrl()}/api/v1/admin/subscriptions/organizations?${qs.toString()}`,
          { headers: buildAuthHeaders() },
        ),
        fetch(`${getApiUrl()}/api/v1/admin/subscriptions/plans`, {
          headers: buildAuthHeaders(),
        }),
      ]);

      const st = await handleApiError(ovRes, () => {
        clearAuth();
        router.replace("/login");
      });
      if (st === "forbidden") {
        setError("You do not have permission to view subscription management.");
        return;
      }
      if (!ovRes.ok || !listRes.ok) {
        setError("Failed to load subscription overview.");
        return;
      }
      setOverview(await ovRes.json());
      setRows(await listRes.json());
      if (plansRes.ok) {
        setPlans(await plansRes.json());
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, [router, search, profileFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDetail = async (orgId: string) => {
    try {
      const res = await fetch(
        `${getApiUrl()}/api/v1/admin/subscriptions/organizations/${orgId}`,
        { headers: buildAuthHeaders() },
      );
      if (res.ok) {
        setSelectedDetail(await res.json());
      }
    } catch {
      alert("Failed to load organization subscription details");
    }
  };

  const runLifecycleAction = async (
    orgId: string,
    subscriptionId: string,
    action: "suspend" | "reactivate" | "cancel",
  ) => {
    const reason = window.prompt(
      `Enter mandatory reason to ${action} this subscription:`,
    );
    if (!reason || !reason.trim()) return;
    if (
      !window.confirm(
        `Confirm ${action.toUpperCase()} for subscription ${subscriptionId}?`,
      )
    ) {
      return;
    }

    setActionBusy(true);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/v1/admin/subscriptions/organizations/${orgId}/${action}`,
        {
          method: "POST",
          headers: buildAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ subscriptionId, reason: reason.trim() }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || `Failed to ${action} subscription`);
        return;
      }
      await loadData();
      if (selectedDetail?.organization?.id === orgId) {
        await openDetail(orgId);
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignOrgId || !assignPlanId || !assignReason.trim()) return;
    setActionBusy(true);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/v1/admin/subscriptions/organizations/${assignOrgId}/assign`,
        {
          method: "POST",
          headers: buildAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            planId: assignPlanId,
            billingInterval: assignInterval,
            replaceExplicit,
            reason: assignReason.trim(),
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || "Failed to assign plan");
        return;
      }
      setAssignOrgId(null);
      setAssignReason("");
      await loadData();
    } finally {
      setActionBusy(false);
    }
  };

  const currentUser = getCurrentUser();
  const canManageStatus =
    currentUser?.role === "SUPER_ADMIN" ||
    (Array.isArray(currentUser?.permissions) &&
      (currentUser.permissions.includes("*") ||
        currentUser.permissions.includes("SUBSCRIPTION_STATUS_MANAGE")));

  const handleRefundTransaction = async (tx: any) => {
    const reason = window.prompt("Mandatory refund reason:");
    if (!reason?.trim()) return;
    const refundedMinor =
      typeof tx?.metadata?.refundedMinor === "number"
        ? tx.metadata.refundedMinor
        : 0;
    const remainingMinor = Math.max(0, (tx.amountMinor ?? 0) - refundedMinor);
    const amountInput = window.prompt(
      `Refund amount in minor units (max ${remainingMinor}). Leave blank for full remaining refund:`,
      String(remainingMinor),
    );
    if (amountInput === null) return;
    const trimmed = amountInput.trim();
    const parsedAmount = trimmed === "" ? undefined : Number(trimmed);
    if (
      parsedAmount !== undefined &&
      (!Number.isInteger(parsedAmount) || parsedAmount <= 0 || parsedAmount > remainingMinor)
    ) {
      setError(`Invalid refund amount. Must be an integer between 1 and ${remainingMinor}.`);
      return;
    }
    if (
      !window.confirm(
        `Confirm refund of ${parsedAmount ?? remainingMinor} ${tx.currency} (minor units) for transaction ${tx.id}?`,
      )
    ) {
      return;
    }
    setActionBusy(true);
    setError("");
    try {
      const res = await fetch(
        `${getApiUrl()}/api/v1/admin/subscriptions/transactions/${tx.id}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...buildAuthHeaders(),
          },
          body: JSON.stringify({
            reason: reason.trim(),
            ...(parsedAmount !== undefined ? { amountMinor: parsedAmount } : {}),
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message || "Refund failed.");
        return;
      }
      await openDetail(tx.organizationId);
      await loadData();
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Subscriptions</h1>
        <p className="text-sm text-text-secondary mt-1">
          Organization subscription directory, lifecycle controls, snapshots, and audit history.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Subscribed Orgs" value={overview.totalSubscribedOrganizations} />
          <StatCard label="Free" value={overview.freeSubscriptions} />
          <StatCard label="Paid" value={overview.paidSubscriptions} />
          <StatCard label="Enterprise" value={overview.enterpriseSubscriptions} />
          <StatCard label="Active" value={overview.statusCounts?.ACTIVE ?? 0} />
          <StatCard label="Past Due" value={overview.statusCounts?.PAST_DUE ?? 0} />
          <StatCard label="Grace Period" value={overview.statusCounts?.GRACE_PERIOD ?? 0} />
          <StatCard label="Expired" value={overview.statusCounts?.EXPIRED ?? 0} />
          <StatCard label="Suspended" value={overview.statusCounts?.SUSPENDED ?? 0} />
        </div>
      )}

      <div className="bg-surface border border-border-subtle rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organization name or ID..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
        />
        <select
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
        >
          <option value="">All Profiles</option>
          {PROFILES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-text-secondary">
            Loading organization subscriptions...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">
            No organization subscriptions match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle text-sm">
              <thead className="bg-surface-muted text-left text-xs uppercase text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Profile</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-primary">
                      {row.organization?.name}
                    </td>
                    <td className="px-4 py-3">{row.profileType}</td>
                    <td className="px-4 py-3">
                      {row.plan?.name}{" "}
                      <span className="text-xs text-text-secondary">
                        (v{row.planVersion})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-muted">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {row.source}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => openDetail(row.organizationId)}
                        className="text-accent hover:underline font-medium"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => {
                          setAssignOrgId(row.organizationId);
                          setReplaceExplicit(true);
                        }}
                        className="text-primary hover:underline"
                      >
                        Replace
                      </button>
                      {row.status === "SUSPENDED" ? (
                        <button
                          disabled={actionBusy}
                          onClick={() =>
                            runLifecycleAction(
                              row.organizationId,
                              row.id,
                              "reactivate",
                            )
                          }
                          className="text-emerald-600 hover:underline"
                        >
                          Reactivate
                        </button>
                      ) : (
                        row.status !== "CANCELED" &&
                        row.status !== "EXPIRED" && (
                          <button
                            disabled={actionBusy}
                            onClick={() =>
                              runLifecycleAction(
                                row.organizationId,
                                row.id,
                                "suspend",
                              )
                            }
                            className="text-amber-600 hover:underline"
                          >
                            Suspend
                          </button>
                        )
                      )}
                      {row.status !== "CANCELED" && row.status !== "EXPIRED" && (
                        <button
                          disabled={actionBusy}
                          onClick={() =>
                            runLifecycleAction(
                              row.organizationId,
                              row.id,
                              "cancel",
                            )
                          }
                          className="text-rose-600 hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {assignOrgId && (
        <form
          onSubmit={handleAssignSubmit}
          className="bg-surface border border-border-strong rounded-2xl p-5 space-y-4"
        >
          <h2 className="text-lg font-semibold text-primary">
            Assign / Replace Organization Plan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              required
              value={assignPlanId}
              onChange={(e) => setAssignPlanId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
            >
              <option value="">Select Plan...</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.profileType}] {p.name} ({p.tier})
                </option>
              ))}
            </select>
            <select
              value={assignInterval}
              onChange={(e) => setAssignInterval(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
            >
              <option value="FREE">FREE</option>
              <option value="MONTHLY">MONTHLY</option>
              <option value="QUARTERLY">QUARTERLY</option>
              <option value="ANNUAL">ANNUAL</option>
              <option value="CUSTOM">CUSTOM</option>
            </select>
            <input
              required
              value={assignReason}
              onChange={(e) => setAssignReason(e.target.value)}
              placeholder="Mandatory audit reason..."
              className="px-3 py-2 rounded-xl border border-border-strong bg-surface text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={replaceExplicit}
              onChange={(e) => setReplaceExplicit(e.target.checked)}
            />
            Explicitly replace existing active/blocking subscription
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={actionBusy}
              className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium"
            >
              Confirm Assignment
            </button>
            <button
              type="button"
              onClick={() => setAssignOrgId(null)}
              className="px-4 py-2 rounded-xl border border-border-strong text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {selectedDetail && (
        <div className="bg-surface border border-border-strong rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">
              {selectedDetail.organization?.name} — History & Snapshots
            </h2>
            <button
              onClick={() => setSelectedDetail(null)}
              className="text-sm text-text-secondary hover:text-primary"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-surface-muted space-y-1">
              <div className="font-semibold text-primary">
                Snapshots ({selectedDetail.snapshots?.length ?? 0})
              </div>
              {selectedDetail.snapshots?.slice(0, 5).map((s: any) => (
                <div key={s.id} className="border-t border-border-subtle pt-1">
                  v{s.version} — {s.reason} ({new Date(s.effectiveFrom).toLocaleString()})
                </div>
              ))}
            </div>
            <div className="p-3 rounded-xl bg-surface-muted space-y-1">
              <div className="font-semibold text-primary">
                Audit Events ({selectedDetail.auditEvents?.length ?? 0})
              </div>
              {selectedDetail.auditEvents?.slice(0, 5).map((a: any) => (
                <div key={a.id} className="border-t border-border-subtle pt-1">
                  {a.action} — {a.reason}
                </div>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-surface-muted space-y-2 text-xs">
            <div className="font-semibold text-primary">
              Payment Transactions ({selectedDetail.transactions?.length ?? 0})
            </div>
            {!selectedDetail.transactions?.length ? (
              <div className="text-text-secondary">No payment transactions recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-text-secondary border-b border-border-subtle">
                    <tr>
                      <th className="py-1.5 pr-3">Date</th>
                      <th className="py-1.5 pr-3">Provider</th>
                      <th className="py-1.5 pr-3">Amount</th>
                      <th className="py-1.5 pr-3">Status</th>
                      <th className="py-1.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {selectedDetail.transactions.map((tx: any) => {
                      const canRefund =
                        canManageStatus &&
                        (tx.status === "SUCCEEDED" || tx.status === "PARTIALLY_REFUNDED");
                      return (
                        <tr key={tx.id}>
                          <td className="py-1.5 pr-3">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td className="py-1.5 pr-3">{tx.provider}</td>
                          <td className="py-1.5 pr-3">
                            {(tx.amountMinor / 100).toFixed(2)} {tx.currency}
                          </td>
                          <td className="py-1.5 pr-3">{tx.status}</td>
                          <td className="py-1.5 text-right">
                            {canRefund ? (
                              <button
                                disabled={actionBusy}
                                onClick={() => handleRefundTransaction(tx)}
                                className="text-rose-600 hover:underline font-medium"
                              >
                                Refund
                              </button>
                            ) : (
                              <span className="text-text-secondary">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface border border-border-subtle rounded-2xl p-4">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-2xl font-bold text-primary mt-1">{value}</div>
    </div>
  );
}
