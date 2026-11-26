"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, isAuthenticated, clearAuth, buildAuthHeaders, hasBrowserAuth } from "@/utils/auth";
import { getApiUrl, handleApiError } from "@/utils/api";
import BusinessNameChangeCard from "@/components/business/BusinessNameChangeCard";

export default function BusinessSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState({
    name: "",
    abn: "",
    timezone: "",
    isPubliclyVisible: true,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const token = getAccessToken();
      if (!token && !isAuthenticated()) return;
      try {
        const apiUrl = getApiUrl();
        const res = await fetch(`${apiUrl}/api/v1/settings/provider/business`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const status = await handleApiError(res, () => {
          clearAuth();
          router.replace('/login');
        });
        if (status === 'ok') {
          const json = await res.json();
          setData({
            name: json.name || '',
            abn: json.abn || '',
            timezone: json.timezone || '',
            isPubliclyVisible: json.isPubliclyVisible !== undefined ? Boolean(json.isPubliclyVisible) : true,
          });
        } else {
          setError('Failed to load business profile');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const token = getAccessToken();
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/settings/provider/business`, {
        method: 'PATCH',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json', }),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setSuccess("Business profile updated successfully");
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to update business profile');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-text-secondary">Loading business profile...</div>;

  return (
    <div className="space-y-6">
      <BusinessNameChangeCard
        currentName={data.name}
        onNameUpdated={() => {
          // Re-fetch
          const token = getAccessToken();
          if (!hasBrowserAuth()) return;
          const apiUrl = getApiUrl();
          fetch(`${apiUrl}/api/v1/settings/provider/business`, {
            headers: buildAuthHeaders(),
          })
            .then((res) => res.json())
            .then((json) => {
              setData((prev) => ({ ...prev, name: json.name || prev.name }));
            })
            .catch(() => {});
        }}
      />

      <div className="bg-surface shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-border-strong">
          <h3 className="text-lg leading-6 font-medium text-primary">General Business Settings</h3>
          <p className="mt-1 text-sm text-text-secondary">Manage your organization details and public directory visibility.</p>
        </div>

        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded text-sm">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-primary">Business Name</label>
                <input
                  type="text"
                  value={data.name || ''}
                  disabled
                  className="mt-1 block w-full rounded-md border-border-strong bg-surface-muted text-text-secondary shadow-sm sm:text-sm cursor-not-allowed px-3 py-2 border"
                />
                <p className="mt-1 text-xs text-text-secondary">
                  Business name can only be changed via formal administrative approval.
                </p>
              </div>

            <div>
              <label className="block text-sm font-medium text-text-primary">ABN / Business ID</label>
              <input
                type="text"
                value={data.abn || ''}
                onChange={e => setData({ ...data, abn: e.target.value })}
                className="mt-1 block w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-brand-purple sm:text-sm px-3 py-2 border bg-surface text-text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary">Timezone</label>
              <input
                type="text"
                value={data.timezone || ''}
                onChange={e => setData({ ...data, timezone: e.target.value })}
                className="mt-1 block w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-brand-purple sm:text-sm px-3 py-2 border bg-surface text-text-primary"
                required
              />
            </div>

            {/* Public Visibility Universal Toggle */}
            <div className="rounded-lg border border-border-subtle bg-slate-50/50 p-4 dark:bg-slate-900/30">
              <div className="flex items-start justify-between">
                <div className="flex flex-col pr-4">
                  <label htmlFor="isPubliclyVisible" className="text-sm font-semibold text-text-primary">
                    Public Directory Visibility
                  </label>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    When enabled, your business and listings appear across Jesmond public discovery and search.
                    When disabled, all your listings are immediately hidden from public visitors while your authorized staff retain private dashboard management access.
                  </p>
                </div>
                <div className="flex items-center h-6">
                  <input
                    id="isPubliclyVisible"
                    name="isPubliclyVisible"
                    type="checkbox"
                    checked={data.isPubliclyVisible}
                    onChange={e => setData({ ...data, isPubliclyVisible: e.target.checked })}
                    className="h-5 w-5 rounded border-border-strong text-accent focus:ring-accent cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border-subtle">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-accent hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-purple disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
}
