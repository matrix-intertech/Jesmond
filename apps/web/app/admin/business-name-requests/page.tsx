"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken, hasBrowserAuth } from "@/utils/auth";
import {
  getAdminNameRequestsQueue,
  startAdminNameRequestReview,
  approveAdminNameRequest,
  rejectAdminNameRequest,
  getAdminNameRequestSignedDocumentUrl,
  NameRequestItemDto,
  NameRequestsStatsDto,
} from "@/services/name-requests.service";
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  FileText,
  Download,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
  Loader2,
  RefreshCw,
  X,
  User as UserIcon,
} from "lucide-react";

export default function AdminBusinessNameRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<NameRequestItemDto[]>([]);
  const [stats, setStats] = useState<NameRequestsStatsDto>({
    total: 0,
    submitted: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<NameRequestItemDto | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadQueue = useCallback(async () => {
    const token = getAccessToken();
    if (!hasBrowserAuth()) return;

    try {
      setLoading(true);
      const res = await getAdminNameRequestsQueue(token, {
        status: statusFilter,
        search: searchQuery,
        page,
        limit: 15,
      });
      setQueue(res.items);
      setStats(res.stats);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        text: err.message || "Failed to load name change requests queue",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, page]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleOpenReview = (item: NameRequestItemDto) => {
    setSelectedRequest(item);
    setReviewerNotes(item.reviewerNotes || "");
    setInternalNotes(item.internalNotes || "");
    setActionFeedback(null);
  };

  const handleCloseReview = () => {
    setSelectedRequest(null);
    setReviewerNotes("");
    setInternalNotes("");
    setActionFeedback(null);
  };

  const handleStartReview = async () => {
    if (!selectedRequest) return;
    const token = getAccessToken();
    if (!hasBrowserAuth()) return;

    try {
      setSubmittingAction(true);
      const updated = await startAdminNameRequestReview(token, selectedRequest.id);
      setSelectedRequest(updated);
      setActionFeedback({
        type: "success",
        text: "Request moved to Under Review. Business has been notified.",
      });
      loadQueue();
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        text: err.message || "Failed to move request to Under Review",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    const token = getAccessToken();
    if (!hasBrowserAuth()) return;

    try {
      setSubmittingAction(true);
      await approveAdminNameRequest(token, selectedRequest.id, {
        reviewerNotes,
        internalNotes,
      });
      setActionFeedback({
        type: "success",
        text: `Name change to "${selectedRequest.proposedName}" approved successfully! Organization name has been updated.`,
      });
      handleCloseReview();
      loadQueue();
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        text: err.message || "Failed to approve name change request",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!reviewerNotes.trim()) {
      setActionFeedback({
        type: "error",
        text: "Reviewer notes are mandatory when rejecting a name change request.",
      });
      return;
    }

    const token = getAccessToken();
    if (!hasBrowserAuth()) return;

    try {
      setSubmittingAction(true);
      await rejectAdminNameRequest(token, selectedRequest.id, {
        reviewerNotes,
        internalNotes,
      });
      setActionFeedback({
        type: "success",
        text: `Request rejected. Business has been notified with reviewer feedback.`,
      });
      handleCloseReview();
      loadQueue();
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        text: err.message || "Failed to reject name change request",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDownloadDoc = async (requestId: string, docId: string) => {
    setDownloadingDocId(docId);
    try {
      const token = getAccessToken();
      if (!hasBrowserAuth()) return;
      const { signedUrl } = await getAdminNameRequestSignedDocumentUrl(
        token,
        requestId,
        docId
      );
      window.open(signedUrl, "_blank");
    } catch (err: any) {
      alert(err.message || "Failed to generate download URL");
    } finally {
      setDownloadingDocId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={13} />
            Submitted
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock size={13} className="animate-spin" />
            Under Review
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} />
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={13} />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Business Name Change Requests
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Review, verify, and approve formal business name change submissions from organizations.
          </p>
        </div>
        <button
          onClick={() => loadQueue()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionFeedback.type === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : (
              <AlertCircle size={18} className="text-rose-600" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-text-secondary hover:text-text-primary p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl border border-border bg-surface shadow-sm">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Total Requests
          </span>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {stats.total}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-sm">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Submitted
          </span>
          <div className="text-2xl font-bold text-amber-900 mt-1">
            {stats.submitted}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 shadow-sm">
          <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
            Under Review
          </span>
          <div className="text-2xl font-bold text-blue-900 mt-1">
            {stats.underReview}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-sm">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Approved
          </span>
          <div className="text-2xl font-bold text-emerald-900 mt-1">
            {stats.approved}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 shadow-sm">
          <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
            Rejected
          </span>
          <div className="text-2xl font-bold text-rose-900 mt-1">
            {stats.rejected}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-muted border border-border overflow-x-auto">
          {["ALL", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {st === "ALL"
                ? "All"
                : st === "SUBMITTED"
                ? "Submitted"
                : st === "UNDER_REVIEW"
                ? "Under Review"
                : st === "APPROVED"
                ? "Approved"
                : "Rejected"}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-3 text-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search business or proposed name..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:border-accent focus:ring-1 focus:ring-accent transition-all"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-secondary flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-accent" />
            <span className="text-sm">Loading name change requests...</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            <Building2 size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-base font-semibold text-text-primary">
              No name change requests found
            </p>
            <p className="text-xs text-text-secondary mt-1">
              {searchQuery || statusFilter !== "ALL"
                ? "Try clearing filters or search queries."
                : "No organizations have submitted business name change requests yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  <th className="px-5 py-3.5">Organization</th>
                  <th className="px-5 py-3.5">Current Name → Proposed Name</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Submitted By</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-surface-muted/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-text-primary">
                        {req.organization?.name}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        {req.organization?.businessCategory || req.organization?.type}
                        {req.organization?.abn ? ` • ABN: ${req.organization.abn}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-text-secondary">
                          {req.currentName}
                        </span>
                        <ArrowRight size={13} className="text-text-secondary" />
                        <span className="font-bold text-text-primary">
                          {req.proposedName}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(req.status)}</td>
                    <td className="px-5 py-4 text-xs text-text-secondary">
                      <div className="font-medium text-text-primary">
                        {req.requestedByUser?.firstName} {req.requestedByUser?.lastName}
                      </div>
                      <div className="text-[11px] text-text-secondary truncate max-w-[160px]">
                        {req.requestedByUser?.email}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-text-secondary whitespace-nowrap">
                      {new Date(req.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleOpenReview(req)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-accent hover:bg-accent/90 transition-all shadow-sm"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review & Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-surface-muted/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">
                    Review Business Name Change Request
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-secondary">
                      Organization: {selectedRequest.organization?.name}
                    </span>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseReview}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Name Comparison Card */}
              <div className="p-4 rounded-xl border border-border bg-surface-muted/40">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Proposed Name Change
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <span className="text-[11px] text-text-secondary block font-medium">
                      Current Approved Name
                    </span>
                    <span className="text-base font-semibold text-text-primary block mt-0.5">
                      {selectedRequest.currentName}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200">
                    <span className="text-[11px] text-emerald-800 block font-medium">
                      Proposed New Name
                    </span>
                    <span className="text-base font-bold text-emerald-950 block mt-0.5">
                      {selectedRequest.proposedName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Requester & Reason */}
              <div className="space-y-3">
                <div className="text-xs text-text-secondary flex items-center gap-2">
                  <UserIcon size={14} />
                  <span>
                    Requested by{" "}
                    <strong className="text-text-primary">
                      {selectedRequest.requestedByUser?.firstName}{" "}
                      {selectedRequest.requestedByUser?.lastName}
                    </strong>{" "}
                    ({selectedRequest.requestedByUser?.email}) on{" "}
                    {new Date(selectedRequest.submittedAt).toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                    Reason Provided by Business
                  </label>
                  <div className="p-3 rounded-xl border border-border bg-surface text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                    {selectedRequest.reason}
                  </div>
                </div>
              </div>

              {/* Supporting Documents */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                  Supporting Evidence / Documents
                </label>
                {selectedRequest.documents && selectedRequest.documents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRequest.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface text-sm"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText size={18} className="text-accent shrink-0" />
                          <span className="font-medium text-text-primary truncate">
                            {doc.filename}
                          </span>
                          <span className="text-xs text-text-secondary shrink-0">
                            ({(doc.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadDoc(selectedRequest.id, doc.id)
                          }
                          disabled={downloadingDocId === doc.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent hover:bg-accent/10 border border-accent/20 transition-all disabled:opacity-50"
                        >
                          <Download size={13} />
                          <span>View / Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary italic p-3 rounded-xl border border-dashed border-border text-center">
                    No supporting documents attached with this request.
                  </p>
                )}
              </div>

              {/* Reviewer Notes (Only editable if request is active) */}
              {(selectedRequest.status === "SUBMITTED" ||
                selectedRequest.status === "UNDER_REVIEW") && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                      Reviewer Notes{" "}
                      <span className="text-text-secondary font-normal">
                        (Shared with business; mandatory if rejecting)
                      </span>
                    </label>
                    <textarea
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder="Add review feedback, instructions, or rejection reasons..."
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border focus:border-accent focus:ring-1 focus:ring-accent text-text-primary text-sm bg-surface transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                      Internal Admin Notes{" "}
                      <span className="text-text-secondary font-normal">
                        (Private; visible only to admins)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Optional internal administrative notes..."
                      className="w-full px-3.5 py-2 rounded-xl border border-border focus:border-accent focus:ring-1 focus:ring-accent text-text-primary text-xs bg-surface transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Decision History if Finalized */}
              {selectedRequest.reviewedAt && (
                <div className="p-3.5 rounded-xl border border-border bg-surface-muted/40 text-xs text-text-secondary space-y-1">
                  <div>
                    <strong>Decision:</strong> {selectedRequest.status} on{" "}
                    {new Date(selectedRequest.reviewedAt).toLocaleString()}
                  </div>
                  {selectedRequest.reviewedByUser && (
                    <div>
                      <strong>Reviewed By:</strong>{" "}
                      {selectedRequest.reviewedByUser.firstName}{" "}
                      {selectedRequest.reviewedByUser.lastName} (
                      {selectedRequest.reviewedByUser.email})
                    </div>
                  )}
                  {selectedRequest.reviewerNotes && (
                    <div className="mt-2 text-text-primary">
                      <strong>Review Notes:</strong> {selectedRequest.reviewerNotes}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-border bg-surface-muted/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCloseReview}
                disabled={submittingAction}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-xl transition-colors"
              >
                Close
              </button>

              {(selectedRequest.status === "SUBMITTED" ||
                selectedRequest.status === "UNDER_REVIEW") && (
                <div className="flex items-center gap-2">
                  {selectedRequest.status === "SUBMITTED" && (
                    <button
                      type="button"
                      onClick={handleStartReview}
                      disabled={submittingAction}
                      className="px-4 py-2 text-xs font-semibold rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
                    >
                      Move to Under Review
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={submittingAction}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50"
                  >
                    Reject Request
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={submittingAction}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
                  >
                    Approve Name Change
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
