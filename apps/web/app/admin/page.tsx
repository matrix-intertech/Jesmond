"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, clearAuth, User } from '@/utils/auth';
import { fetchFeatureFlag, handleApiError } from '@/utils/api';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);
  const [pendingProperties, setPendingProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<"enable" | "disable" | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const token = getAccessToken();
        if (!token) return;

        // Load pending properties with unified error handling
        const pendingRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/properties/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const pendingStatus = await handleApiError(pendingRes, () => { clearAuth(); router.replace('/login'); });
        if (pendingStatus === 'ok') {
          const data = await pendingRes.json();
          setPendingProperties(Array.isArray(data) ? data : data.properties || []);
        } else if (pendingStatus === 'forbidden') {
          setError('You do not have permission to view pending properties.');
        } else {
          setError('Failed to load pending properties.');
        }

        // Try load feature flag silently
        const flag = await fetchFeatureFlag('PAYMENTS_BOOKING', token, () => { clearAuth(); router.replace('/login'); });
        if (flag) setPaymentsEnabled(flag.enabled);

      } catch (e) {
        setError('An unexpected error occurred while loading the dashboard.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const confirmToggle = (action: "enable" | "disable") => {
    setPendingAction(action);
    setShowConfirm(true);
  };

  const performToggle = async () => {
    if (!pendingAction) return;
    const enable = pendingAction === 'enable';
    try {
      const token = getAccessToken();
      if (!token) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/features/PAYMENTS_BOOKING`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enable }),
      });
      const status = await handleApiError(res, () => { clearAuth(); router.push('/login'); });
      if (status === 'ok') {
        const data = await res.json();
        setPaymentsEnabled(data.enabled);
        setToast(`Payments & Booking ${data.enabled ? 'enabled' : 'disabled'}.`);
        setTimeout(() => setToast(''), 3000);
      } else if (status === 'forbidden') {
        setError('You do not have permission to modify this feature.');
      } else {
        setError('Unable to update feature status.');
      }
    } catch (e) {
      setError('Unable to update feature status.');
    } finally {
      setShowConfirm(false);
      setPendingAction(null);
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Loading dashboard...</div>;
  }

  return (
    <>
      <PageHeader
        title={user?.role === 'SUPER_ADMIN' ? 'Super Admin Dashboard' : 'Admin Dashboard'}
        description="Manage accommodation listings, review submissions and oversee marketplace activity."
        primaryAction={{ label: 'View All Properties', href: '/admin/properties', onClick: () => router.push('/admin/properties') }}
      />

      {error && <div className="bg-rose-100 text-rose-700 p-4 rounded-xl mb-6 font-semibold">{error}</div>}
      {toast && <div className="bg-emerald-100 text-emerald-700 p-4 rounded-xl mb-6 font-semibold">{toast}</div>}

      {/* Needs Your Attention Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Needs Your Attention</h2>
        {pendingProperties.length === 0 ? (
          <div className="bg-slate-100 p-6 rounded-xl text-center">
            <p className="font-medium text-slate-900">You're all caught up</p>
            <p className="text-slate-500">No properties are currently waiting for review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="min-w-full table-auto hidden md:table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-900">Property</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-900">Location</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-900">Provider</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-900">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingProperties.map((prop) => (
                  <tr key={prop.id} className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-900">{prop.name}</td>
                    <td className="px-4 py-2 text-slate-900">{prop.suburb?.name}, {prop.suburb?.city?.name}</td>
                    <td className="px-4 py-2 text-slate-900">{prop.organization?.name}</td>
                    <td className="px-4 py-2"><StatusBadge status="PENDING_APPROVAL" /></td>
                    <td className="px-4 py-2 text-slate-900">
                      <Link href={`/admin/properties/${prop.id}`} className="text-indigo-600 hover:underline">Review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile Cards */}
            <div className="grid gap-4 md:hidden mt-4">
              {pendingProperties.map((prop) => (
                <div key={prop.id} className="bg-white rounded-xl shadow-sm p-4 border">
                  <h3 className="font-semibold text-slate-900 mb-1">{prop.name}</h3>
                  <p className="text-sm text-slate-600 mb-1">{prop.suburb?.name}, {prop.suburb?.city?.name}</p>
                  <p className="text-sm text-slate-600 mb-1">Provider: {prop.organization?.name}</p>
                  <StatusBadge status="PENDING_APPROVAL" />
                  <div className="mt-2">
                    <Link href={`/admin/properties/${prop.id}`} className="text-indigo-600 hover:underline text-sm">Review</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Feature Controls – only for SUPER_ADMIN */}
      {user?.role === 'SUPER_ADMIN' && (
        <section className="bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b">Feature Controls</h2>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 p-6 rounded-xl border">
            <div className="mb-4 md:mb-0 max-w-lg">
              <h3 className="font-bold text-lg text-slate-900 mb-2">Payments &amp; Booking</h3>
              <p className="text-slate-600 mb-3">Allow students to make payments and activate accommodation bookings.</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-500">Status:</span>
                {paymentsEnabled ? (
                  <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-100 px-2 py-1 rounded-md text-xs tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> ENABLED
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-600 font-bold bg-slate-200 px-2 py-1 rounded-md text-xs tracking-wider">
                    <span className="w-2 h-2 rounded-full border-2 border-slate-400"></span> DISABLED
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => confirmToggle(paymentsEnabled ? 'disable' : 'enable')}
              className={`font-bold py-3 px-6 rounded-xl transition min-w-[120px] ${paymentsEnabled ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-emerald-600 text-white hover:emerald-700'}`}
            >
              {paymentsEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </section>
      )}

      <ConfirmationDialog
        open={showConfirm}
        title={pendingAction === 'enable' ? 'Enable Payments & Booking' : 'Disable Payments & Booking'}
        message={pendingAction === 'enable' ? 'Enable Payments & Booking? Students will be able to make payments and activate bookings.' : 'Are you sure you want to disable Payments & Booking? Students will no longer be able to start new payments or activate bookings.'}
        onConfirm={performToggle}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
