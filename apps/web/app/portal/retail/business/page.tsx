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
    businessCategory: "",
    timezone: "",
    branding: null,
    settings: null,
  });

  const [location, setLocation] = useState<any>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locForm, setLocForm] = useState({ address: "", lat: 0, lng: 0 });
  const [locSubmitting, setLocSubmitting] = useState(false);
  const [locError, setLocError] = useState("");

  const fetchData = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const [profileRes, locRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/businesses/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/businesses/location`, {
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

  const openLocationModal = () => {
    setLocForm({
      address: location?.address || "",
      lat: location?.lat || 0,
      lng: location?.lng || 0,
    });
    setLocError("");
    setShowLocationModal(true);
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocSubmitting(true);
    setLocError("");
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/businesses/location`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: locForm.address,
          lat: parseFloat(locForm.lat as any),
          lng: parseFloat(locForm.lng as any),
        })
      });
      if (res.ok) {
        await fetchData();
        setShowLocationModal(false);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setLocError(errJson.message || 'Failed to update location');
      }
    } catch (e: any) {
      setLocError(e.message || 'Network error');
    } finally {
      setLocSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Business Profile"
        description="Manage your business information and localization."
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
                    <span className="font-medium text-text-primary">Coordinates:</span> {location.lat}, {location.lng}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No location set.</p>
              )}
            </div>
          </div>

          <div className="bg-surface shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-medium text-text-primary mb-6">General details</h2>
              {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded text-sm">{error}</div>}
              {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded text-sm">{success}</div>}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-text-primary">Business Name</label>
                    <input type="text" value={data.name || ''} disabled className="mt-1 block w-full rounded-md border-border-strong bg-surface-muted text-text-secondary shadow-sm sm:text-sm cursor-not-allowed" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary">Business Category</label>
                    <input type="text" value={data.businessCategory || ''} disabled className="mt-1 block w-full rounded-md border-border-strong bg-surface-muted text-text-secondary shadow-sm sm:text-sm cursor-not-allowed" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary">Timezone</label>
                    <input type="text" value={data.timezone || ''} onChange={e => setData({...data, timezone: e.target.value})} className="mt-1 block w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm" placeholder="e.g. America/Los_Angeles" />
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

      {showLocationModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-surface rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg leading-6 font-medium text-text-primary mb-4">
                  {location?.address ? 'Edit Location' : 'Add Your Location'}
                </h3>
                {locError && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded text-sm">{locError}</div>}

                <form onSubmit={handleLocationSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary">Business Address</label>
                    <input type="text" required value={locForm.address} onChange={e => setLocForm({...locForm, address: e.target.value})} className="mt-1 block w-full border border-border-strong rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary">Latitude (-90 to 90)</label>
                    <input type="number" step="any" required min="-90" max="90" value={locForm.lat} onChange={e => setLocForm({...locForm, lat: parseFloat(e.target.value) || 0})} className="mt-1 block w-full border border-border-strong rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary">Longitude (-180 to 180)</label>
                    <input type="number" step="any" required min="-180" max="180" value={locForm.lng} onChange={e => setLocForm({...locForm, lng: parseFloat(e.target.value) || 0})} className="mt-1 block w-full border border-border-strong rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm" />
                  </div>

                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="submit"
                      disabled={locSubmitting}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-accent text-base font-medium text-white hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent sm:col-start-2 sm:text-sm"
                    >
                      {locSubmitting ? 'Saving...' : 'Save Location'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLocationModal(false)}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-border-strong shadow-sm px-4 py-2 bg-surface text-base font-medium text-text-primary hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent sm:mt-0 sm:col-start-1 sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
