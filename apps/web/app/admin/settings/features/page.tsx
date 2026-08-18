"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";

export default function FeaturesPage() {
  const router = useRouter();
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeatures = async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/features`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
        if (status === 'ok') {
          const data = await res.json();
          setFeatures(data);
        } else {
          setError('Failed to load feature flags');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatures();
  }, [router]);

  const toggleFeature = async (key: string, currentEnabled: boolean) => {
    if (!confirm(`Are you sure you want to ${currentEnabled ? 'disable' : 'enable'} ${key}?`)) return;

    setSubmitting(key);
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/features/${key}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (res.ok) {
        setFeatures(features.map(f => f.key === key ? { ...f, enabled: !currentEnabled } : f));
      } else {
        alert('Failed to update feature');
      }
    } catch (e) {
      alert('Error updating feature');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading features...</div>;

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Feature Flags</h3>
        <p className="mt-1 text-sm text-gray-500">Toggle experimental or restricted functionality.</p>
      </div>
      {error ? (
        <div className="p-4 bg-rose-50 text-rose-700 m-4 rounded-md">
          {error}
          <button onClick={() => window.location.reload()} className="ml-4 font-medium underline">Retry</button>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {features.map((f) => (
            <li key={f.key} className="px-4 py-4 sm:px-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{f.key}</p>
                <p className="text-xs text-gray-500 mt-1">Status: {f.enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <button
                onClick={() => toggleFeature(f.key, f.enabled)}
                disabled={submitting === f.key}
                className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  f.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                } ${submitting === f.key ? 'opacity-50' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                    f.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </li>
          ))}
          {features.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500 text-sm">No feature flags found.</li>
          )}
        </ul>
      )}
    </div>
  );
}
