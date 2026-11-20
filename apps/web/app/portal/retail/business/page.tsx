"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { getApiUrl, handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";
import BusinessLocationModal from "@/components/business/BusinessLocationModal";
import BusinessNameChangeCard from "@/components/business/BusinessNameChangeCard";

export default function BusinessProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState({
    name: "",
    type: "",
    businessCategory: "",
    timezone: "",
    isPubliclyVisible: true,
    branding: null,
    settings: null,
  });

  const [location, setLocation] = useState<any>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const fetchData = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const apiUrl = getApiUrl();
      const [profileRes, locRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/retail/businesses/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/v1/retail/businesses/location`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      const pStatus = await handleApiError(profileRes, () => { clearAuth(); router.replace('/login'); });
      if (pStatus === 'ok') {
        const json = await profileRes.json();
        setData({
          name: json.name || "",
          type: json.type || "",
          businessCategory: json.businessCategory || "",
          timezone: json.timezone || "",
          isPubliclyVisible: json.isPubliclyVisible !== undefined ? Boolean(json.isPubliclyVisible) : true,
          branding: json.branding || null,
          settings: json.settings || null,
        });
      }

      if (locRes.ok) {
        const locJson = await locRes.json();
        setLocation(locJson);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const token = getAccessToken();
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/retail/businesses/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timezone: data.timezone,
          isPubliclyVisible: data.isPubliclyVisible,
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

  const openLocationModal = () => {
    setShowLocationModal(true);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Business Profile"
        description="Manage your business information, operating location, and public visibility."
      />

      {loading ? (
        <div className="p-8 text-center text-text-secondary bg-surface shadow rounded-lg animate-pulse">Loading profile...</div>
      ) : (
        <>
          {!location?.address && (
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between shadow-sm">
              <div>
                <h3 className="text-lg font-medium text-text-primary">Add Your Location</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Add your business address and location so customers can find you easily.
                </p>
              </div>
              <button
                onClick={openLocationModal}
                className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-accent hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
              >
                Add Location
              </button>
            </div>
          )}

          <div className="bg-surface shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-text-primary">Location details</h2>
                {location?.address && (
                  <button onClick={openLocationModal} className="text-sm text-accent hover:underline">
                    Edit Location
                  </button>
                )}
              </div>

              {location?.address ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-text-secondary">
                  <div>
                    <span className="font-medium text-text-primary">Address:</span> {location.address}
                  </div>
                  <div>
                    <span className="font-medium text-text-primary">Coordinates:</span>{" "}
                    {typeof location.lat === "number" && typeof location.lng === "number"
                      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                      : `${location.lat ?? ""}, ${location.lng ?? ""}`}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No location set.</p>
              )}
            </div>
          </div>

          {/* Business Name Change Request & Management */}
          <BusinessNameChangeCard
            currentName={data.name}
            onNameUpdated={fetchData}
          />

          <div className="bg-surface shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-medium text-text-primary mb-6">General details</h2>
              {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded text-sm">{error}</div>}
              {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded text-sm">{success}</div>}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-text-primary">Business Name</label>
                    <input type="text" value={data.name || ''} disabled className="mt-1 block w-full rounded-md border-border-strong bg-surface-muted text-text-secondary shadow-sm sm:text-sm cursor-not-allowed px-3 py-2 border" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary">Business Category</label>
                    <input type="text" value={data.businessCategory || ''} disabled className="mt-1 block w-full rounded-md border-border-strong bg-surface-muted text-text-secondary shadow-sm sm:text-sm cursor-not-allowed px-3 py-2 border" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-text-primary">Timezone</label>
                    <input type="text" value={data.timezone || ''} onChange={e => setData({...data, timezone: e.target.value})} className="mt-1 block w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm px-3 py-2 border bg-surface text-text-primary" placeholder="e.g. Australia/Sydney" />
                  </div>
                </div>

                {/* Public Visibility Universal Toggle */}
                <div className="rounded-lg border border-border-subtle bg-slate-50/50 p-4 dark:bg-slate-900/30">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col pr-4">
                      <label htmlFor="retailIsPubliclyVisible" className="text-sm font-semibold text-text-primary">
                        Public Directory Visibility
                      </label>
                      <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                        When enabled, your business, branches, and active services/catalog appear across Jesmond public discovery and search.
                        When disabled, your business is hidden from public visitors while authorized staff retain private dashboard management access.
                      </p>
                    </div>
                    <div className="flex items-center h-6">
                      <input
                        id="retailIsPubliclyVisible"
                        name="retailIsPubliclyVisible"
                        type="checkbox"
                        checked={data.isPubliclyVisible}
                        onChange={e => setData({ ...data, isPubliclyVisible: e.target.checked })}
                        className="h-5 w-5 rounded border-border-strong text-accent focus:ring-accent cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border-subtle">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-accent hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      <BusinessLocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        currentLocation={location}
        onSuccess={(updated) => setLocation(updated)}
      />
    </div>
  );
}
