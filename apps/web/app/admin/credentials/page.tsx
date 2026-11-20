"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken } from "@/utils/auth";
import {
  getAdminCredentialsQueue,
  reviewAdminCredential,
  getAdminSignedDocumentUrl,
} from "@/services/credentials.service";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  ExternalLink,
  Check,
  X,
  HelpCircle,
  Eye,
  Loader2,
  Filter,
} from "lucide-react";

export default function AdminCredentialsPage() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, totalPages: 1 });

  // Filters
  const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");

  // Active Review Item
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadQueue = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      setLoading(true);
      const res = await getAdminCredentialsQueue(token, {
        status: statusFilter,
        category: categoryFilter,
        state: stateFilter,
      });
      setQueue(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setFeedbackMsg({
        type: "error",
        text: e.message || "Failed to load verification queue",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, stateFilter]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleOpenReview = (item: any) => {
    setSelectedItem(item);
    setDecisionNotes(item.reviewerNotes || "");
    setInternalNotes(item.internalNotes || "");
  };

  const handleCloseReview = () => {
    setSelectedItem(null);
    setDecisionNotes("");
    setInternalNotes("");
  };

  const handleDecision = async (
    decision: "VERIFIED" | "REJECTED" | "NEEDS_INFORMATION" | "UNABLE_TO_VERIFY",
  ) => {
    if (!selectedItem) return;
    const token = getAccessToken();
    if (!token) return;

    try {
      setSubmittingReview(true);
      await reviewAdminCredential(token, selectedItem.id, {
        decision,
        notes: decisionNotes,
        internalNotes,
      });
      setFeedbackMsg({
        type: "success",
        text: `Credential successfully updated to ${decision}.`,
      });
      handleCloseReview();
      await loadQueue();
    } catch (e: any) {
      setFeedbackMsg({
        type: "error",
        text: e.message || "Failed to submit review decision",
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleViewAdminDoc = async (docId: string) => {
    if (!selectedItem) return;
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await getAdminSignedDocumentUrl(token, selectedItem.id, docId);
      window.open(res.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      alert("Failed to generate secure admin document link: " + e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-outfit text-primary tracking-tight">
            Business Credentials Compliance Queue
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Review and audit business licences, registrations, and official government credentials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/credentials/abn-exemptions"
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-text-primary hover:bg-surface-muted transition-colors"
          >
            Review ABN Exemptions →
          </a>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`mb-6 p-4 rounded-xl text-sm border flex items-center justify-between ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-bold uppercase underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-surface p-4 rounded-2xl border border-border-strong mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase">
          <Filter size={14} /> Filters:
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          data-testid="status-filter"
          className="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="NEEDS_INFORMATION">Needs Information</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
          <option value="UNABLE_TO_VERIFY">Unable to Verify</option>
        </select>

        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          data-testid="category-filter"
          className="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary focus:outline-none"
        >
          <option value="ALL">All Categories</option>
          <option value="RETAIL">Retail</option>
          <option value="MECHANICS">Mechanics</option>
          <option value="FOOD">Food</option>
          <option value="SERVICES">Services</option>
          <option value="RENTALS">Rentals</option>
        </select>

        {/* State */}
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          data-testid="state-filter"
          className="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary focus:outline-none"
        >
          <option value="ALL">All States</option>
          <option value="NSW">NSW</option>
          <option value="VIC">VIC</option>
          <option value="QLD">QLD</option>
          <option value="WA">WA</option>
          <option value="SA">SA</option>
          <option value="TAS">TAS</option>
          <option value="ACT">ACT</option>
          <option value="NT">NT</option>
        </select>

        <span className="ml-auto text-xs text-text-secondary">
          Showing <strong>{queue.length}</strong> of {meta.total} records
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <Loader2 size={32} className="animate-spin text-accent" />
          <p className="text-sm text-text-secondary">Loading review queue...</p>
        </div>
      ) : queue.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border-strong p-12 text-center text-text-secondary">
          <ShieldCheck size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
          <p className="font-semibold text-text-primary">No credentials matching filter</p>
          <p className="text-xs mt-1">Select a different filter or status above.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted border-b border-border text-text-secondary uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Business Entity</th>
                  <th className="px-4 py-3">Category / State</th>
                  <th className="px-4 py-3">Credential Type</th>
                  <th className="px-4 py-3">Licence Number</th>
                  <th className="px-4 py-3">Docs</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-primary">{item.organization?.name}</div>
                      <div className="text-[11px] text-text-secondary">
                        ABN: {item.organization?.abn || "None / Exempt"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-text-primary">
                        {item.organization?.businessCategory}
                      </span>
                      <span className="text-text-secondary"> ({item.state || "National"})</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-primary">
                        {item.credentialType?.name}
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        {item.credentialType?.code}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-text-primary">
                      {item.credentialNumber || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.documents?.length > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[11px]">
                          {item.documents.length} doc(s)
                        </span>
                      ) : (
                        <span className="text-text-secondary text-[11px]">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.status === "VERIFIED" ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                          Verified
                        </span>
                      ) : item.status === "PENDING_REVIEW" ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
                          Pending Review
                        </span>
                      ) : item.status === "REJECTED" ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold">
                          Rejected
                        </span>
                      ) : item.status === "NEEDS_INFORMATION" ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">
                          Needs Info
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 font-bold">
                          {item.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenReview(item)}
                        data-testid={`review-btn-${item.id}`}
                        className="px-3 py-1 rounded-lg bg-primary text-white font-semibold text-xs hover:bg-primary-hover transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Drawer / Modal */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div className="bg-surface rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 border border-border-strong max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold font-outfit text-primary">
                  Review Credential Submission
                </h2>
                <p className="text-xs text-text-secondary">
                  {selectedItem.credentialType?.name} • {selectedItem.organization?.name}
                </p>
              </div>
              <button
                onClick={handleCloseReview}
                className="p-1 rounded-lg text-text-secondary hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            {/* Business info */}
            <div className="grid grid-cols-2 gap-3 bg-surface-muted p-4 rounded-xl border border-border text-xs mb-4">
              <div>
                <span className="text-text-secondary">Business:</span>
                <span className="font-bold text-primary ml-1">
                  {selectedItem.organization?.name}
                </span>
              </div>
              <div>
                <span className="text-text-secondary">ABN:</span>
                <span className="font-semibold text-primary ml-1">
                  {selectedItem.organization?.abn || "None / Exempt"}
                </span>
              </div>
              <div>
                <span className="text-text-secondary">Category:</span>
                <span className="font-semibold text-primary ml-1">
                  {selectedItem.organization?.businessCategory}
                </span>
              </div>
              <div>
                <span className="text-text-secondary">State:</span>
                <span className="font-semibold text-primary ml-1">
                  {selectedItem.state || "National"}
                </span>
              </div>
              {selectedItem.organization?.RetailBranch?.[0]?.address && (
                <div className="col-span-2 border-t border-border pt-1">
                  <span className="text-text-secondary">Branch:</span>
                  <span className="text-text-primary ml-1">
                    {selectedItem.organization.RetailBranch[0].address}
                  </span>
                </div>
              )}
            </div>

            {/* Credential Data */}
            <div className="space-y-3 mb-6">
              <div className="text-xs font-bold uppercase text-text-primary">
                Submitted Credential Information
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs bg-surface-muted/60 p-4 rounded-xl border border-border">
                <div>
                  <span className="text-text-secondary">Licence Number:</span>
                  <div className="font-mono font-bold text-sm text-primary mt-0.5">
                    {selectedItem.credentialNumber || "Not provided"}
                  </div>
                </div>
                <div>
                  <span className="text-text-secondary">Expiry Date:</span>
                  <div className="font-semibold text-primary mt-0.5">
                    {selectedItem.expiresAt
                      ? new Date(selectedItem.expiresAt).toLocaleDateString()
                      : "No expiry"}
                  </div>
                </div>
              </div>

              {/* Supporting documents */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-text-primary">
                  Attached Documents (15-min secure preview)
                </span>
                {selectedItem.documents?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedItem.documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText size={16} className="text-accent shrink-0" />
                          <span className="font-medium text-text-primary truncate">
                            {doc.filename}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleViewAdminDoc(doc.id)}
                          data-testid={`admin-view-doc-${doc.id}`}
                          className="px-3 py-1 rounded-lg bg-surface-muted text-accent font-semibold hover:bg-border transition-colors flex items-center gap-1"
                        >
                          <Eye size={12} />
                          <span>View Document</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-surface-muted rounded-xl text-xs text-text-secondary italic">
                    No documents uploaded.
                  </div>
                )}
              </div>
            </div>

            {/* Decision Notes */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Reviewer Feedback (Visible to Business Partner)
                </label>
                <textarea
                  rows={2}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="e.g. Verified against NSW Fair Trading register, or Please upload updated certificate copy."
                  data-testid="reviewer-notes-input"
                  className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Internal Compliance Audit Notes (Jesmond Admin Only)
                </label>
                <textarea
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="e.g. Checked ABN registration ledger and state trade registry on 2026-11-20."
                  data-testid="internal-notes-input"
                  className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Decision Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => handleDecision("NEEDS_INFORMATION")}
                disabled={submittingReview}
                data-testid="decision-needs-info-btn"
                className="px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors"
              >
                Request Info
              </button>
              <button
                type="button"
                onClick={() => handleDecision("REJECTED")}
                disabled={submittingReview}
                data-testid="decision-reject-btn"
                className="px-3 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold hover:bg-rose-100 transition-colors"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => handleDecision("VERIFIED")}
                disabled={submittingReview}
                data-testid="decision-verify-btn"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Check size={14} />
                <span>Approve & Verify</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
