"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlobalNav } from "@/components/marketing/GlobalNav";

export default function AdminDashboardPage() {
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const router = useRouter();

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return router.push('/login');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/features/PAYMENTS_BOOKING`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentsEnabled(data.enabled);
      } else {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
        } else {
          setError('Failed to load feature states.');
        }
      }
    } catch (e) {
      setError('An error occurred loading features.');
    } finally {
      setLoading(false);
    }
  };

  const togglePayments = async () => {
    const action = paymentsEnabled ? 'Disable' : 'Enable';
    const confirmMessage = paymentsEnabled 
      ? "Are you sure you want to disable Payments & Booking? Students will no longer be able to start new payments or activate bookings. Existing confirmed bookings must remain unaffected."
      : "Enable Payments & Booking? Students will be able to make payments and activate bookings.";

    if (!window.confirm(confirmMessage)) return;

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/features/PAYMENTS_BOOKING`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !paymentsEnabled })
      });

      if (res.ok) {
        const data = await res.json();
        setPaymentsEnabled(data.enabled);
        setToast(`Payments & Booking ${data.enabled ? 'enabled' : 'disabled'}.`);
        setTimeout(() => setToast(''), 3000);
      } else {
        setError('Unable to update feature status.');
      }
    } catch (e) {
      setError('Unable to update feature status.');
    }
  };

  if (loading) return <div className="p-10 text-center">Loading dashboard...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <GlobalNav />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Super Admin Dashboard</h1>
        
        {error && <div className="bg-rose-100 text-rose-700 p-4 rounded-xl mb-6 font-semibold">{error}</div>}
        {toast && <div className="bg-emerald-100 text-emerald-700 p-4 rounded-xl mb-6 font-semibold">{toast}</div>}

        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b">Feature Controls</h2>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 p-6 rounded-xl border">
            <div className="mb-4 md:mb-0 max-w-lg">
              <h3 className="font-bold text-lg text-slate-900 mb-2">Payments & Booking</h3>
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
              onClick={togglePayments}
              className={`font-bold py-3 px-6 rounded-xl transition min-w-[120px] ${
                paymentsEnabled 
                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {paymentsEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
