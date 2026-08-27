"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";

export default function BusinessProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState({
    name: "",
    type: "",
    timezone: "",
    branding: null,
    settings: null,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/businesses/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
        if (status === 'ok') {
          const json = await res.json();
          setData({
            name: json.name || "",
            type: json.type || "",
            timezone: json.timezone || "",
            branding: json.branding || null,
            settings: json.settings || null,
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/businesses/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          timezone: data.timezone,
        })
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

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Business Profile"
        description="Manage your retail organization settings and localization."
      />

      {loading ? (
        <div className="p-8 text-center text-slate-500 bg-white shadow rounded-lg animate-pulse">Loading profile...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded text-sm">{error}</div>}
            {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded text-sm">{success}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Business Name</label>
                  <input type="text" value={data.name || ''} disabled className="mt-1 block w-full rounded-md border-gray-300 bg-surface-muted text-gray-500 shadow-sm sm:text-sm cursor-not-allowed" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Organization Type</label>
                  <input type="text" value={data.type || ''} disabled className="mt-1 block w-full rounded-md border-gray-300 bg-surface-muted text-gray-500 shadow-sm sm:text-sm cursor-not-allowed" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Timezone</label>
                  <input type="text" value={data.timezone || ''} onChange={e => setData({...data, timezone: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm" placeholder="e.g. America/Los_Angeles" />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
