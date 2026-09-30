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
          <div key={app.id} className="rounded-xl border bg-surface p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-primary">{app.student?.firstName} {app.student?.lastName}</p>
                <p className="mt-1 text-sm text-text-secondary">{app.roomType?.property?.name}</p>
              </div>
              <Link href={`/admin/applications/${app.id}`} className="shrink-0 text-sm font-semibold text-accent hover:underline">View</Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs uppercase text-text-muted">Room</dt><dd className="font-medium text-text-primary">{app.roomType?.name}</dd></div>
              <div><dt className="text-xs uppercase text-text-muted">Provider</dt><dd className="font-medium text-text-primary">{app.roomType?.property?.organization?.name}</dd></div>
              <div><dt className="text-xs uppercase text-text-muted">Move-in</dt><dd className="font-medium text-text-primary">{new Date(app.moveInDate).toLocaleDateString()}</dd></div>
              <div><dt className="text-xs uppercase text-text-muted">Status</dt><dd className="font-medium text-text-primary">{app.status}</dd></div>
              <div><dt className="text-xs uppercase text-text-muted">Price</dt><dd className="font-medium text-text-primary">${(app.lockedPrice / 100).toFixed(2)}</dd></div>
              <div><dt className="text-xs uppercase text-text-muted">Created</dt><dd className="font-medium text-text-primary">{new Date(app.createdAt).toLocaleDateString()}</dd></div>
            </dl>
          </div>
        ))}
      </div>

      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="min-w-full table-auto">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-primary">Student</th>
              <th className="px-4 py-2 text-left font-medium text-primary">Property</th>
              <th className="px-4 py-2 text-left font-medium text-primary">Room Type</th>
              <th className="px-4 py-2 text-left font-medium text-primary">Provider</th>
              <th className="px-4 py-2 text-left font-medium text-primary">Move‑In</th>
              <th className="px-4 py-2 text-left font-medium text-primary">Duration (mo)</th>
              <th className="px-4 py-2 text-left font-medium text-primary">Locked Price</th>
              <th className="px-4 py-2 text-left font-medium text-primary">Status</th>
              <th className="px-4 py-2 text-left font-medium text-primary">Created At</th>
              <th className="px-4 py-2 text-right font-medium text-primary">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {applications.map((app) => (
              <tr key={app.id} className="hover:bg-surface-muted">
                <td className="px-4 py-2 text-primary">{app.student?.firstName} {app.student?.lastName}</td>
                <td className="px-4 py-2 text-primary">{app.roomType?.property?.name}</td>
                <td className="px-4 py-2 text-primary">{app.roomType?.name}</td>
                <td className="px-4 py-2 text-primary">{app.roomType?.property?.organization?.name}</td>
                <td className="px-4 py-2 text-primary">{new Date(app.moveInDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-primary">{app.durationMonths}</td>
                <td className="px-4 py-2 text-primary">${(app.lockedPrice / 100).toFixed(2)}</td>
                <td className="px-4 py-2 text-primary">{app.status}</td>
                <td className="px-4 py-2 text-primary">{new Date(app.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/applications/${app.id}`} className="text-accent hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
