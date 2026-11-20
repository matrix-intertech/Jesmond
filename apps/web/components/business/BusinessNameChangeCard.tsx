"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken } from "@/utils/auth";
import { getApiUrl } from "@/utils/api";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Building2,
  ArrowRight,
} from "lucide-react";
import BusinessNameChangeModal from "./BusinessNameChangeModal";

interface BusinessNameChangeCardProps {
  currentName: string;
  onNameUpdated?: () => void;
}

export default function BusinessNameChangeCard({
  currentName,
  onNameUpdated,
}: BusinessNameChangeCardProps) {
  const [currentRequest, setCurrentRequest] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const apiUrl = getApiUrl();
      const [currentRes, historyRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/business/name-change-requests/current`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/v1/business/name-change-requests/history`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (currentRes.ok) {
        const curJson = await currentRes.json();
        setCurrentRequest(curJson);
      } else {
        setCurrentRequest(null);
      }

      if (historyRes.ok) {
        const histJson = await historyRes.json();
        setHistory(histJson || []);
      }
    } catch (err) {
      console.error("Failed to load name change requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleDownloadDoc = async (requestId: string, docId: string) => {
    setDownloadingDocId(docId);
    try {
      const token = getAccessToken();
      const apiUrl = getApiUrl();
      const res = await fetch(
        `${apiUrl}/api/v1/business/name-change-requests/${requestId}/documents/${docId}/signed-url`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const { signedUrl } = await res.json();
        window.open(signedUrl, "_blank");
      }
    } catch (err) {
      console.error("Failed to download document:", err);
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
    <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Top Banner / Current Status Header */}
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Approved Business Name
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
              <h3 className="text-xl font-bold text-text-primary mt-1">
                {currentName || "Unnamed Business"}
              </h3>
              <p className="text-xs text-text-secondary mt-1 max-w-xl">
                This approved name appears across Jesmond public discovery, store directories, customer receipts, and search listings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={Boolean(currentRequest)}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-xl text-white bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Request Name Change
            </button>
          </div>
        </div>

        {/* Active Request Alert Banner */}
        {currentRequest && (
          <div className="mt-5 p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-amber-950">
                    Name Change Request in Progress:
                  </span>
                  <span className="font-bold underline text-amber-900">
                    &quot;{currentRequest.proposedName}&quot;
                  </span>
                  {getStatusBadge(currentRequest.status)}
                </div>
                <p className="text-xs text-amber-800 mt-1">
                  Submitted on {new Date(currentRequest.submittedAt).toLocaleDateString()} by {currentRequest.requestedByUser?.firstName} {currentRequest.requestedByUser?.lastName}.
                  Your current business name remains active until reviewed by an administrator.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* History Accordion Toggle */}
        {history.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              <span>Request History ({history.length})</span>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        )}

        {/* History Accordion Content */}
        {showHistory && history.length > 0 && (
          <div className="mt-3 space-y-3 pt-2">
            {history.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-border bg-surface-muted/30 text-sm space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-text-secondary">
                      {req.currentName}
                    </span>
                    <ArrowRight size={14} className="text-text-secondary" />
                    <span className="font-bold text-text-primary">
                      {req.proposedName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(req.status)}
                    <span className="text-xs text-text-secondary">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-text-secondary">
                  <strong className="text-text-primary">Reason:</strong> {req.reason}
                </div>

                {/* Administrator Review Notes */}
                {req.reviewerNotes && (
                  <div className="p-2.5 rounded-lg bg-surface border border-border text-xs text-text-primary">
                    <strong className="text-text-secondary">Administrator Review Feedback:</strong>{" "}
                    {req.reviewerNotes}
                  </div>
                )}

                {/* Supporting documents */}
                {req.documents && req.documents.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="text-[11px] font-semibold text-text-secondary">
                      Documents:
                    </span>
                    {req.documents.map((doc: any) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => handleDownloadDoc(req.id, doc.id)}
                        disabled={downloadingDocId === doc.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface border border-border text-xs text-accent hover:underline disabled:opacity-50"
                      >
                        <FileText size={12} />
                        <span className="truncate max-w-[150px]">{doc.filename}</span>
                        <Download size={11} className="ml-0.5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BusinessNameChangeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentName={currentName}
        onSuccess={() => {
          fetchRequests();
          if (onNameUpdated) onNameUpdated();
        }}
      />
    </div>
  );
}
