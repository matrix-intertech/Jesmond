"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";

export default function AdminSettingsPage() {
  const router = useRouter();
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  }, []);

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (error) return <div className="p-12 text-center text-rose-600">{error}</div>;

  return (
    <>
      <PageHeader title="Admin Settings" description="Feature flags and configuration for the platform" />
      <div className="mt-6 space-y-4">
        {features.map((f) => (
          <div key={f.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl">
            <div className="text-slate-900 font-medium">{f.key}</div>
            <div className={`px-3 py-1 rounded ${f.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-800'}`}> 
              {f.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
