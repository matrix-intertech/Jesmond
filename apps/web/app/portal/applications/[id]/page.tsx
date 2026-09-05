"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { getAccessToken, clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';

interface ApplicationDetail {
  id: string;
  status: string;
  moveInDate: string;
  durationMonths: number;
  lockedPrice: number;
  createdAt: string;
  student: {
    firstName: string;
    lastName: string;
    email: string;
  };
  roomType: {
    name: string;
    inventory: number;
    property: {
      name: string;
      status: string;
    };
  };
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const onAuthError = () => {
    clearAuth();
    router.replace('/login');
  };
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchApplication();
  }, [id]);

  const fetchApplication = async () => {
    try {
      const token = getAccessToken();
      if (!token) { onAuthError(); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications/provider/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setApp(await res.json());
      } else {
        setError('Application not found');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject' | 'remove') => {
    if (action === 'remove' && !confirm('Are you sure you want to remove this student from the application? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications/${id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        // Refresh
        await fetchApplication();
      } else {
        const err = await res.json();
        setError(err.message || `Failed to ${action} application`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading application...</div>;
  if (!app) return <div className="p-10 text-center text-rose-500">{error}</div>;

  return (
    <>
      <PageHeader title="Application Details" onBack={() => router.push('/portal/applications')} />
      <div className="max-w-4xl mx-auto py-8">
        
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-brand-navy mb-2">Application Details</h1>
              <p className="text-slate-500">Submitted on {new Date(app.createdAt).toLocaleDateString()}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider ${
              app.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
              app.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
              app.status === 'WITHDRAWN' ? 'bg-slate-100 text-slate-700' :
              app.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
              'bg-amber-100 text-amber-700'
            }`}>
              {app.status.replace('_', ' ')}
            </span>
          </div>

          {error && <div className="bg-rose-100 text-rose-700 p-4 rounded-xl mb-6 font-semibold">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4 text-brand-navy border-b pb-2">Student Information</h3>
              <p className="text-slate-600 mb-2"><span className="font-semibold w-24 inline-block">Name:</span> {app.student.firstName} {app.student.lastName}</p>
              <p className="text-slate-600 mb-2"><span className="font-semibold w-24 inline-block">Email:</span> {app.student.email}</p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4 text-brand-navy border-b pb-2">Property Details</h3>
              <p className="text-slate-600 mb-2"><span className="font-semibold w-24 inline-block">Property:</span> {app.roomType.property.name}</p>
              <p className="text-slate-600 mb-2"><span className="font-semibold w-24 inline-block">Room:</span> {app.roomType.name}</p>
              <p className="text-slate-600 mb-2">
                <span className="font-semibold w-24 inline-block">Inventory:</span> 
                <span className={app.roomType.inventory > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                  {app.roomType.inventory} remaining
                </span>
              </p>
            </div>
          </div>

          <div className="bg-surface-muted p-6 rounded-xl border mb-8">
            <h3 className="font-bold text-lg mb-4 text-brand-navy">Lease Terms</h3>
            <div className="flex justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase">Move In</p>
                <p className="font-bold text-lg">{new Date(app.moveInDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase">Duration</p>
                <p className="font-bold text-lg">{app.durationMonths} Months</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase">Locked Price</p>
                <p className="font-bold text-lg text-brand-orange">${(app.lockedPrice / 100).toFixed(2)} / week</p>
              </div>
            </div>
          </div>

          {(app.status === 'PENDING_REVIEW' || app.status === 'APPROVED') && (
            <div className="flex gap-4 border-t pt-8">
              {app.status === 'PENDING_REVIEW' && (
                <>
                  <button 
                    onClick={() => handleAction('approve')}
                    disabled={actionLoading || app.roomType.inventory <= 0}
                    className={`flex-1 font-bold py-3 px-6 rounded-xl transition ${
                      app.roomType.inventory > 0 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {actionLoading ? 'Processing...' : (app.roomType.inventory > 0 ? 'Approve Application' : 'Out of Stock')}
                  </button>
                  <button 
                    onClick={() => handleAction('reject')}
                    disabled={actionLoading}
                    className="flex-1 bg-white border-2 border-rose-600 text-rose-600 font-bold py-3 px-6 rounded-xl hover:bg-rose-50 transition"
                  >
                    {actionLoading ? 'Processing...' : 'Reject Application'}
                  </button>
                </>
              )}
              <button 
                onClick={() => handleAction('remove')}
                disabled={actionLoading}
                className="flex-1 bg-rose-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-rose-700 transition"
              >
                {actionLoading ? 'Processing...' : 'Remove Student'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
