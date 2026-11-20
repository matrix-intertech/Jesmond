"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken } from "@/utils/auth";
import {
  getAdminAbnExemptionQueue,
  reviewAdminAbnExemption,
} from "@/services/credentials.service";
import {
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  Check,
  X,
  Loader2,
} from "lucide-react";

export default function AdminAbnExemptionsPage() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, totalPages: 1 });

  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
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
      const res = await getAdminAbnExemptionQueue(token);
      setQueue(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setFeedbackMsg({
        type: "error",
        text: e.message || "Failed to load ABN exemption queue",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleDecision = async (decision: "APPROVED" | "REJECTED") => {
    if (!selectedOrg) return;
    const token = getAccessToken();
    if (!token) return;

    try {
      setSubmittingReview(true);
      await reviewAdminAbnExemption(token, selectedOrg.organizationId, {
        decision,
        notes: decisionNotes,
      });
      setFeedbackMsg({
        type: "success",
        text: `ABN Exemption successfully ${decision.toLowerCase()}.`,
      });
      setSelectedOrg(null);
      setDecisionNotes("");
      await loadQueue();
    } catch (e: any) {
      setFeedbackMsg({
        type: "error",
        text: e.message || "Failed to submit ABN exemption review",
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <a
            href="/admin/credentials"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Credentials Queue
          </a>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-outfit text-primary tracking-tight">
            ABN Exemption Requests
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Review formal ABN statutory exemption requests under Australian tax guidelines.
          </p>
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

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <Loader2 size={32} className="animate-spin text-accent" />
          <p className="text-sm text-text-secondary">Loading exemption requests...</p>
        </div>
      ) : queue.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border-strong p-12 text-center text-text-secondary">
          <ShieldCheck size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
          <p className="font-semibold text-text-primary">No pending ABN exemption requests</p>
          <p className="text-xs mt-1">All business entity exemptions have been reviewed.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted border-b border-border text-text-secondary uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Business Entity</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Reason for Exemption</th>
                  <th className="px-4 py-3">Requested At</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-primary">
                      {item.organizationName}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-secondary">
                      {item.businessCategory}
                    </td>
                    <td className="px-4 py-3 text-text-primary max-w-md truncate">
                      {item.reason}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.requestedAt
                        ? new Date(item.requestedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedOrg(item)}
                        data-testid={`review-exemption-btn-${item.organizationId}`}
                        className="px-3 py-1 rounded-lg bg-primary text-white font-semibold text-xs hover:bg-primary-hover transition-colors"
                      >
                        Review Request
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {selectedOrg && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div className="bg-surface rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-border-strong">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-base font-bold font-outfit text-primary">
                Review ABN Exemption Request
              </h2>
              <button
                onClick={() => setSelectedOrg(null)}
                className="p-1 rounded-lg text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-surface-muted p-4 rounded-xl border border-border text-xs space-y-2 mb-4">
              <div>
                <span className="text-text-secondary">Business Entity:</span>
                <span className="font-bold text-primary ml-1">
                  {selectedOrg.organizationName}
                </span>
              </div>
              <div>
                <span className="text-text-secondary">Category:</span>
                <span className="font-semibold text-primary ml-1">
                  {selectedOrg.businessCategory}
                </span>
              </div>
              <div className="border-t border-border pt-2">
                <span className="text-text-secondary block font-semibold mb-1">
                  Stated Justification:
                </span>
                <p className="text-text-primary leading-relaxed bg-surface p-3 rounded-lg border border-border">
                  "{selectedOrg.reason}"
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-text-primary mb-1">
                Compliance Review Notes
              </label>
              <textarea
                rows={2}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="e.g. Valid hobbyist exception confirmed, or Insufficient justification provided."
                data-testid="exemption-notes-input"
                className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => handleDecision("REJECTED")}
                disabled={submittingReview}
                data-testid="reject-exemption-btn"
                className="px-4 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold hover:bg-rose-100 transition-colors"
              >
                Reject Exemption
              </button>
              <button
                type="button"
                onClick={() => handleDecision("APPROVED")}
                disabled={submittingReview}
                data-testid="approve-exemption-btn"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Approve Exemption</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
