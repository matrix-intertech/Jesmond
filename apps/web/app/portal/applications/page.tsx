"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { getAccessToken, clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import Link from 'next/link';

interface Application {
  id: string;
  status: string;
  moveInDate: string;
  durationMonths: number;
  lockedPrice: number;
  roomType: {
    name: string;
    property: {
      id: string;
      name: string;
    }
  };
  student: {
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
}

export default function ProviderApplicationsPage() {
  const onAuthError = () => {
    clearAuth();
    router.replace('/login');
  };
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const token = getAccessToken();
      if (!token) { onAuthError(); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications/provider`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setApplications(await res.json());
      } else if (status === 'forbidden') {
        // unauthorized but not logout; keep empty list
        setApplications([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleRemove = async (applicationId: string) => {
    if (!confirm('Are you sure you want to remove this student from the application? This action cannot be undone.')) return;

    setActionLoadingId(applicationId);
    try {
      const token = getAccessToken();
      if (!token) { onAuthError(); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications/${applicationId}/remove`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        fetchApplications();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading applications...</div>;

  return (
    <>
      <PageHeader title="Student Applications" description="Review applications for your properties" onBack={() => router.push('/portal')} />
      <div className="max-w-7xl mx-auto py-8">

        {applications.length === 0 ? (
          <div className="bg-white p-10 rounded-xl shadow-sm text-center border">
            <h2 className="text-xl font-bold mb-2">No applications yet</h2>
            <p className="text-slate-500 mb-6">Applications for your properties will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-muted border-b text-sm text-slate-500 uppercase tracking-wider">
                  <th className="p-4 font-semibold">Student</th>
                  <th className="p-4 font-semibold">Property</th>
                  <th className="p-4 font-semibold">Room</th>
                  <th className="p-4 font-semibold">Move In</th>
                  <th className="p-4 font-semibold">Duration</th>
                  <th className="p-4 font-semibold">Price</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {applications.map(app => (
                  <tr key={app.id} className="hover:bg-surface-muted transition">
                    <td className="p-4">
                      <Link href={`/portal/applications/${app.id}`} className="block hover:text-brand-orange transition">
                        <div className="font-bold text-brand-navy">{app.student.firstName} {app.student.lastName}</div>
                        <div className="text-xs text-slate-500">{app.student.email}</div>
                      </Link>
                    </td>
                    <td className="p-4 font-medium">{app.roomType.property.name}</td>
                    <td className="p-4">{app.roomType.name}</td>
                    <td className="p-4">{new Date(app.moveInDate).toLocaleDateString()}</td>
                    <td className="p-4">{app.durationMonths} months</td>
                    <td className="p-4 font-medium text-brand-orange">${(app.lockedPrice / 100).toFixed(2)}/wk</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                        app.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        app.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                        app.status === 'WITHDRAWN' ? 'bg-slate-100 text-slate-700' :
                        app.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {app.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      {(app.status === 'PENDING_REVIEW' || app.status === 'APPROVED') && (
                        <button
                          onClick={() => handleRemove(app.id)}
                          disabled={actionLoadingId === app.id}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition border border-rose-200"
                        >
                          {actionLoadingId === app.id ? 'Removing...' : 'Remove Student'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
