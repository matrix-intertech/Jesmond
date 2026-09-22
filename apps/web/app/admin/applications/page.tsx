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
      <div className="mt-6 space-y-3 md:hidden">
        {applications.map((app) => (
          <div key={app.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-brand-navy">{app.student?.firstName} {app.student?.lastName}</p>
                <p className="mt-1 text-sm text-slate-500">{app.roomType?.property?.name}</p>
              </div>
              <Link href={`/admin/applications/${app.id}`} className="shrink-0 text-sm font-semibold text-brand-orange hover:underline">View</Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs uppercase text-slate-400">Room</dt><dd className="font-medium text-slate-700">{app.roomType?.name}</dd></div>
              <div><dt className="text-xs uppercase text-slate-400">Provider</dt><dd className="font-medium text-slate-700">{app.roomType?.property?.organization?.name}</dd></div>
              <div><dt className="text-xs uppercase text-slate-400">Move-in</dt><dd className="font-medium text-slate-700">{new Date(app.moveInDate).toLocaleDateString()}</dd></div>
              <div><dt className="text-xs uppercase text-slate-400">Status</dt><dd className="font-medium text-slate-700">{app.status}</dd></div>
              <div><dt className="text-xs uppercase text-slate-400">Price</dt><dd className="font-medium text-slate-700">${(app.lockedPrice / 100).toFixed(2)}</dd></div>
              <div><dt className="text-xs uppercase text-slate-400">Created</dt><dd className="font-medium text-slate-700">{new Date(app.createdAt).toLocaleDateString()}</dd></div>
            </dl>
          </div>
        ))}
      </div>

      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="min-w-full table-auto">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-brand-navy">Student</th>
              <th className="px-4 py-2 text-left font-medium text-brand-navy">Property</th>
              <th className="px-4 py-2 text-left font-medium text-brand-navy">Room Type</th>
              <th className="px-4 py-2 text-left font-medium text-brand-navy">Provider</th>
              <th className="px-4 py-2 text-left font-medium text-brand-navy">Move‑In</th>
              <th className="px-4 py-2 text-left font-medium text-brand-navy">Duration (mo)</th>
              <th className="px-4 py-2 text-left font-medium text-brand-navy">Locked Price</th>
              <th className="px-4 py-2 text-left font-medium text-brand-navy">Status</th>
              <th className="px-4 py-2 text-left font-medium text-brand-navy">Created At</th>
              <th className="px-4 py-2 text-right font-medium text-brand-navy">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {applications.map((app) => (
              <tr key={app.id} className="hover:bg-surface-muted">
                <td className="px-4 py-2 text-brand-navy">{app.student?.firstName} {app.student?.lastName}</td>
                <td className="px-4 py-2 text-brand-navy">{app.roomType?.property?.name}</td>
                <td className="px-4 py-2 text-brand-navy">{app.roomType?.name}</td>
                <td className="px-4 py-2 text-brand-navy">{app.roomType?.property?.organization?.name}</td>
                <td className="px-4 py-2 text-brand-navy">{new Date(app.moveInDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-brand-navy">{app.durationMonths}</td>
                <td className="px-4 py-2 text-brand-navy">${(app.lockedPrice / 100).toFixed(2)}</td>
                <td className="px-4 py-2 text-brand-navy">{app.status}</td>
                <td className="px-4 py-2 text-brand-navy">{new Date(app.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/applications/${app.id}`} className="text-brand-orange hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
