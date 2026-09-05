"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { getAccessToken, clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";


interface Application {
  id: string;
  status: string;
  moveInDate: string;
  durationMonths: number;
  lockedPrice: number;
  createdAt: string;
  roomType: {
    name: string;
    property: {
      id: string;
      name: string;
    }
  }
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const onAuthError = () => { clearAuth(); router.replace('/login'); };
  const [applications, setApplications] = useState<Application[]>([]);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getAccessToken();
        if (!token) { onAuthError(); return; }

        const appRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications/my`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const appStatus = await handleApiError(appRes, onAuthError);
        if (appStatus === 'ok') {
          setApplications(await appRes.json());
        } else if (appStatus === 'forbidden') {
          setError('You are not authorized to view applications.');
        } else {
          setError('Failed to load applications.');
        }

        const flagRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/payments/status`);
        if (flagRes.ok) {
          const flagData = await flagRes.json();
          setPaymentsEnabled(flagData.enabled);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleWithdraw = async (applicationId: string) => {
    if (!confirm('Are you sure you want to withdraw this application? This action cannot be undone.')) return;

    setActionLoadingId(applicationId);
    setError('');
    try {
      const token = getAccessToken();
      if (!token) { onAuthError(); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications/${applicationId}/withdraw`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        const updated = await res.json();
        setApplications(prev => prev.map(a => a.id === applicationId ? { ...a, status: updated.status } : a));
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to withdraw application');
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred');
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = applications.filter(a => a.status === 'PENDING_REVIEW').length;
  const approvedCount = applications.filter(a => a.status === 'APPROVED').length;
  const rejectedCount = applications.filter(a => a.status === 'REJECTED').length;

  if (loading) return <div className="p-10 text-center">Loading your dashboard...</div>;
  if (error) return <div className="p-10 text-center text-rose-600">{error}</div>;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold font-outfit text-brand-navy">Student Dashboard</h1>
            <p className="text-slate-500 mt-1">Your accommodation journey at a glance</p>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/student/saved" className="text-brand-orange hover:underline font-medium text-sm">
              Saved Properties
            </Link>
            <Link href="/search" className="bg-brand-orange text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition">
              Find Accommodation
            </Link>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Applications" value={applications.length} />
          {pendingCount > 0 && <StatCard label="Pending Review" value={pendingCount} />}
          {approvedCount > 0 && <StatCard label="Approved" value={approvedCount} />}
          {rejectedCount > 0 && <StatCard label="Rejected" value={rejectedCount} />}
        </div>

        <h2 className="text-xl font-bold text-brand-navy mb-6 font-outfit">My Applications</h2>

        {applications.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8">
            <EmptyState 
              title="No applications yet" 
              description="When you apply for a room, it will appear here."
              action={{ label: "Find Accommodation", href: "/search" }}
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-surface-muted border-b text-sm text-slate-500 uppercase tracking-wider">
                  <th className="p-4 font-semibold">Property</th>
                  <th className="p-4 font-semibold">Room Type</th>
                  <th className="p-4 font-semibold">Move In</th>
                  <th className="p-4 font-semibold">Duration</th>
                  <th className="p-4 font-semibold">Price Locked</th>
                  <th className="p-4 font-semibold">Applied</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {applications.map(app => (
                  <tr key={app.id} className="hover:bg-surface-muted transition">
                    <td className="p-4 font-medium">
                      <Link href={`/property/${app.roomType.property.id}`} className="text-brand-orange hover:underline">
                        {app.roomType.property.name}
                      </Link>
                    </td>
                    <td className="p-4">{app.roomType.name}</td>
                    <td className="p-4">{new Date(app.moveInDate).toLocaleDateString()}</td>
                    <td className="p-4">{app.durationMonths} months</td>
                    <td className="p-4">${(app.lockedPrice / 100).toFixed(2)}/wk</td>
                    <td className="p-4 text-slate-400">{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="p-4">
                      {app.status === 'APPROVED' ? (
                        <div className="flex flex-col gap-2 items-start">
                          <StatusBadge status={app.status as any} />
                          {paymentsEnabled ? (
                            <button className="text-xs font-bold bg-brand-navy text-white px-3 py-1.5 rounded-lg hover:bg-brand-navy/90 transition">
                              Proceed to Payment
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-rose-600">Payments unavailable.</span>
                          )}
                        </div>
                      ) : (
                        <StatusBadge status={app.status as any} />
                      )}
                    </td>
                    <td className="p-4">
                      {(app.status === 'PENDING_REVIEW' || app.status === 'APPROVED') && (
                        <button
                          onClick={() => handleWithdraw(app.id)}
                          disabled={actionLoadingId === app.id}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition border border-rose-200"
                        >
                          {actionLoadingId === app.id ? 'Withdrawing...' : 'Withdraw'}
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
  );
}
