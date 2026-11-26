"use client";

import { useState } from "react";
import { getAccessToken, buildAuthHeaders } from "@/utils/auth";
import { getApiUrl } from "@/utils/api";
import { X, Upload, AlertCircle, FileText, CheckCircle2 } from "lucide-react";

interface BusinessNameChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSuccess: () => void;
}

export default function BusinessNameChangeModal({
  isOpen,
  onClose,
  currentName,
  onSuccess,
}: BusinessNameChangeModalProps) {
  const [proposedName, setProposedName] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const validTypes = ["application/pdf", "image/png", "image/jpeg"];
      if (!validTypes.includes(selected.type)) {
        setError("Only PDF, PNG, or JPG/JPEG documents are supported.");
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        setError("File size cannot exceed 10MB.");
        return;
      }
      setError("");
      setFile(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedProposed = proposedName.trim();
    const trimmedReason = reason.trim();

    if (!trimmedProposed) {
      setError("Please provide a proposed new business name.");
      return;
    }

    if (trimmedProposed.toLowerCase() === currentName.trim().toLowerCase()) {
      setError("Proposed business name must be different from current approved name.");
      return;
    }

    if (!trimmedReason || trimmedReason.length < 5) {
      setError("Please explain the reason for the name change (minimum 5 characters).");
      return;
    }

    setSubmitting(true);
    const token = getAccessToken();
    const apiUrl = getApiUrl();

    try {
      // 1. Submit Request
      const res = await fetch(`${apiUrl}/api/v1/business/name-change-requests`, {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json", }),
        body: JSON.stringify({
          proposedName: trimmedProposed,
          reason: trimmedReason,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to submit name change request.");
      }

      const createdRequest = await res.json();

      // 2. Upload supporting document if attached
      if (file && createdRequest?.id) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(
          `${apiUrl}/api/v1/business/name-change-requests/${createdRequest.id}/documents`,
          {
            method: "POST",
            headers: buildAuthHeaders(),
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          console.warn("Supporting document upload encountered an issue, but request was created.");
        }
      }

      setProposedName("");
      setReason("");
      setFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-xl bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-surface-muted/40">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Request Business Name Change
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Submit a formal request to change your organization&apos;s business name.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Name (Read Only) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Current Approved Business Name
            </label>
            <div className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-muted/60 text-text-primary font-medium text-sm flex items-center justify-between">
              <span>{currentName}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active
              </span>
            </div>
          </div>

          {/* Proposed Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Proposed New Business Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={proposedName}
              onChange={(e) => setProposedName(e.target.value)}
              placeholder="e.g. Acme Supermarket & Organics"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border focus:border-accent focus:ring-1 focus:ring-accent text-text-primary text-sm bg-surface transition-all"
              required
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Reason for Name Change <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the background for this change (e.g. rebranding, business expansion, entity update)..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border focus:border-accent focus:ring-1 focus:ring-accent text-text-primary text-sm bg-surface transition-all resize-none"
              required
            />
          </div>

          {/* Supporting Documents */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Supporting Document (Optional)
            </label>
            <p className="text-xs text-text-secondary mb-2">
              Attach any certificate of registration, business name registration, or official notice.
            </p>

            {file ? (
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-muted/40 text-sm">
                <div className="flex items-center gap-2 text-text-primary truncate">
                  <FileText size={18} className="text-accent shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs text-text-secondary shrink-0">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-xs text-rose-600 hover:underline shrink-0 ml-2"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-accent/60 hover:bg-surface-muted/20 transition-all text-center">
                <Upload size={20} className="text-text-secondary mb-1" />
                <span className="text-xs font-medium text-text-primary">
                  Click to upload supporting file
                </span>
                <span className="text-[11px] text-text-secondary mt-0.5">
                  PDF, PNG, or JPG up to 10MB
                </span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,image/png,image/jpeg"
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-800 leading-relaxed">
            <strong>Important notice:</strong> Submitting this request does not immediately update your business name. Your current business name remains active until reviewed and approved by an administrator.
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-xl shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Name Change Request"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
