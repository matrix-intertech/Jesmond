"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GlobalNav } from "@/components/marketing/GlobalNav";

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
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return router.push('/login');

      const appRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (appRes.ok) {
        setApplications(await appRes.json());
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <GlobalNav />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 pt-24">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <div className="flex gap-3">
            <Link href="/student/saved" className="text-indigo-600 hover:underline font-medium text-sm">
              Saved Properties
            </Link>
            <Link href="/search" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
              Find Accommodation
            </Link>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border p-5">
            <div className="text-3xl font-bold text-slate-900">{applications.length}</div>
            <div className="text-sm text-slate-500 mt-1">Total Applications</div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="text-3xl font-bold text-amber-600">{pendingCount}</div>
            <div className="text-sm text-slate-500 mt-1">Pending Review</div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="text-3xl font-bold text-emerald-600">{approvedCount}</div>
            <div className="text-sm text-slate-500 mt-1">Approved</div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="text-3xl font-bold text-rose-600">{rejectedCount}</div>
            <div className="text-sm text-slate-500 mt-1">Rejected</div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">My Applications</h2>

        {applications.length === 0 ? (
          <div className="bg-white p-10 rounded-xl shadow-sm text-center border">
            <h2 className="text-xl font-bold mb-2">No applications yet</h2>
            <p className="text-slate-500 mb-6">When you apply for a room, it will appear here.</p>
            <Link href="/search" className="bg-indigo-600 text-white px-6 py-2 rounded-full hover:bg-indigo-700 transition">
              Find Accommodation
            </Link>
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
                        <div className="flex flex-col gap-2">
                          <span className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 inline-block w-fit">
                            APPROVED
                          </span>
                          {paymentsEnabled ? (
                            <button className="text-xs font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition">
                              Proceed to Payment
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-rose-600">Payments currently unavailable.</span>
                          )}
                        </div>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                          app.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {app.status.replace('_', ' ')}
                        </span>
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
