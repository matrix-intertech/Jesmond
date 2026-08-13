"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GlobalNav } from "@/components/marketing/GlobalNav";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { getAccessToken, clearAuth, getCurrentUser } from '@/utils/auth';
import { handleApiError } from '@/utils/api';

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
  const [applications, setApplications] = useState<Application[]>([]);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = getAccessToken();
      const currentUser = getCurrentUser();
      if (!token || !currentUser || currentUser.role !== 'STUDENT') {
        if (!currentUser) clearAuth();
        return router.push(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' ? '/admin' : currentUser?.role === 'PROVIDER' ? '/portal' : '/login');
      }

      const appRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const appStatus = await handleApiError(appRes, () => { clearAuth(); router.push('/login'); });
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

  const pendingCount = applications.filter(a => a.status === 'PENDING_REVIEW').length;
  const approvedCount = applications.filter(a => a.status === 'APPROVED').length;
  const rejectedCount = applications.filter(a => a.status === 'REJECTED').length;

  if (loading) return <div className="p-10 text-center">Loading your dashboard...</div>;
  if (error) return <div className="p-10 text-center text-rose-600">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <GlobalNav />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 pt-24">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold font-outfit text-slate-900">Student Dashboard</h1>
            <p className="text-slate-500 mt-1">Your accommodation journey at a glance</p>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/student/saved" className="text-indigo-600 hover:underline font-medium text-sm">
              Saved Properties
            </Link>
            <Link href="/search" className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
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

        <h2 className="text-xl font-bold text-slate-900 mb-6 font-outfit">My Applications</h2>

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
                <tr className="bg-slate-50 border-b text-sm text-slate-500 uppercase tracking-wider">
                  <th className="p-4 font-semibold">Property</th>
                  <th className="p-4 font-semibold">Room Type</th>
                  <th className="p-4 font-semibold">Move In</th>
                  <th className="p-4 font-semibold">Duration</th>
                  <th className="p-4 font-semibold">Price Locked</th>
                  <th className="p-4 font-semibold">Applied</th>
                  <th className="p-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {applications.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-medium">
                      <Link href={`/property/${app.roomType.property.id}`} className="text-indigo-600 hover:underline">
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
                            <button className="text-xs font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
