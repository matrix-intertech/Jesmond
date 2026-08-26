"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { Download, Trash2 } from "lucide-react";

export default function PrivacySettings() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reason, setReason] = useState("");

  const handleDownload = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/data-export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to export data.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'my-data-export.json');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e) {
      console.error(e);
      alert("Failed to export data.");
    }
  };

  const handleDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to request account deletion? This action cannot be undone.")) return;

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/delete-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        setSuccess("Account deletion request submitted. Support will contact you shortly.");
        setReason("");
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to submit request');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-brand-navy">Privacy & Data</h3>
          <p className="mt-1 text-sm text-gray-500">Manage your personal data and account lifecycle.</p>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-brand-navy">Download My Data</p>
              <p className="text-sm text-gray-500">Request an export of your personal information.</p>
            </div>
            <button onClick={handleDownload} className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-surface-muted">
              <Download className="w-4 h-4 mr-2" />
              Request Export
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-rose-200">
        <div className="px-4 py-5 sm:px-6 border-b border-rose-200 bg-rose-50">
          <h3 className="text-lg leading-6 font-medium text-rose-900">Danger Zone</h3>
          <p className="mt-1 text-sm text-rose-700">Irreversible account actions.</p>
        </div>
        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded text-sm">{success}</div>}

          <form onSubmit={handleDeletion} className="space-y-4">
            <div>
              <p className="text-sm font-medium text-brand-navy mb-2">Request Account Deletion</p>
              <p className="text-sm text-gray-500 mb-4">Once your request is approved, all of your data will be permanently removed. Please provide a reason (optional).</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm"
                rows={3}
                placeholder="Reason for leaving..."
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting...' : 'Request Deletion'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
