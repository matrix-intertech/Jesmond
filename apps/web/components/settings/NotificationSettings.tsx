"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";

export default function NotificationSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState({
    emailNotifications: false,
    smsNotifications: false,
    pushNotifications: false,
  });

  useEffect(() => {
    const fetchNotifications = async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
        if (status === 'ok') {
          const json = await res.json();
          setData(json);
        } else {
          setError('Failed to load notifications');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/notifications`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setSuccess("Notification preferences updated");
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to update preferences');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading preferences...</div>;

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-brand-navy">Notification Preferences</h3>
        <p className="mt-1 text-sm text-gray-500">Decide how you want to be contacted by the platform.</p>
      </div>

      <div className="p-6">
        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center">
            <input
              id="emailNotifications"
              type="checkbox"
              checked={data.emailNotifications || false}
              onChange={e => setData({...data, emailNotifications: e.target.checked})}
              className="h-4 w-4 text-brand-orange focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="emailNotifications" className="ml-3 block text-sm font-medium text-gray-700">Email Notifications</label>
          </div>

          <div className="flex items-center">
            <input
              id="smsNotifications"
              type="checkbox"
              checked={data.smsNotifications || false}
              onChange={e => setData({...data, smsNotifications: e.target.checked})}
              className="h-4 w-4 text-brand-orange focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="smsNotifications" className="ml-3 block text-sm font-medium text-gray-700">SMS Notifications</label>
          </div>

          <div className="flex items-center">
            <input
              id="pushNotifications"
              type="checkbox"
              checked={data.pushNotifications || false}
              onChange={e => setData({...data, pushNotifications: e.target.checked})}
              className="h-4 w-4 text-brand-orange focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="pushNotifications" className="ml-3 block text-sm font-medium text-gray-700">Push Notifications</label>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
