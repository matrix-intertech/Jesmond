"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";

export default function AdminApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchApps = async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/applications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
        if (status === 'ok') {
          const data = await res.json();
          setApplications(data);
        } else {
          setError('Failed to load applications');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchApps();
  }, []);

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (error) return <div className="p-12 text-center text-rose-600">{error}</div>;

  return (
    <>
      <PageHeader title="Admin Applications" description="Read‑only view of all student applications" />
      <div className="overflow-x-auto mt-6">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-900">Student</th>
              <th className="px-4 py-2 text-left font-medium text-slate-900">Property</th>
              <th className="px-4 py-2 text-left font-medium text-slate-900">Room Type</th>
              <th className="px-4 py-2 text-left font-medium text-slate-900">Provider</th>
              <th className="px-4 py-2 text-left font-medium text-slate-900">Move‑In</th>
              <th className="px-4 py-2 text-left font-medium text-slate-900">Duration (mo)</th>
              <th className="px-4 py-2 text-left font-medium text-slate-900">Locked Price</th>
              <th className="px-4 py-2 text-left font-medium text-slate-900">Status</th>
              <th className="px-4 py-2 text-left font-medium text-slate-900">Created At</th>
              <th className="px-4 py-2 text-right font-medium text-slate-900">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {applications.map((app) => (
              <tr key={app.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-900">{app.student?.firstName} {app.student?.lastName}</td>
                <td className="px-4 py-2 text-slate-900">{app.roomType?.property?.name}</td>
                <td className="px-4 py-2 text-slate-900">{app.roomType?.name}</td>
                <td className="px-4 py-2 text-slate-900">{app.roomType?.property?.organization?.name}</td>
                <td className="px-4 py-2 text-slate-900">{new Date(app.moveInDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-slate-900">{app.durationMonths}</td>
                <td className="px-4 py-2 text-slate-900">${(app.lockedPrice / 100).toFixed(2)}</td>
                <td className="px-4 py-2 text-slate-900">{app.status}</td>
                <td className="px-4 py-2 text-slate-900">{new Date(app.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/applications/${app.id}`} className="text-indigo-600 hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
