'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '@/utils/api';
import { getAccessToken, isAuthenticated } from '@/utils/auth';
import { Calendar, Loader2, Clock, MapPin, ArrowLeft, Info, XCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

export default function AppointmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login?redirect=/my-appointments/' + id);
      return;
    }

    async function fetchAppointment() {
      try {
        const token = getAccessToken();
        const res = await fetch(`${getApiUrl()}/api/v1/appointments/my/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login?redirect=/my-appointments/' + id);
            return;
          }
          if (res.status === 404 || res.status === 403) {
            throw new Error('Appointment not found or you do not have permission.');
          }
          throw new Error('Failed to load appointment details');
        }
        const data = await res.json();
        setAppointment(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAppointment();
  }, [id, router]);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/api/v1/appointments/my/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: cancelReason })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to cancel appointment');
      }
      
      const updated = await res.json();
      setAppointment(updated);
      setShowCancel(false);
    } catch (err: any) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 max-w-[800px] w-full mx-auto px-6 py-20">
        <div className="flex items-center justify-center p-20 bg-surface rounded-3xl border border-border-strong/60 shadow-sm">
          <Loader2 className="animate-spin text-accent" size={40} />
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="flex-1 max-w-[800px] w-full mx-auto px-6 py-12">
        <Link href="/my-appointments" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent font-medium mb-8">
          <ArrowLeft size={18} /> Back to My Appointments
        </Link>
        <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-100 text-center shadow-sm">
          <XCircle size={40} className="mx-auto mb-4 opacity-80" />
          <h2 className="text-xl font-bold mb-2">Could not load appointment</h2>
          <p className="mb-6">{error}</p>
          <Link href="/my-appointments" className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold">Go Back</Link>
        </div>
      </div>
    );
  }

  const date = new Date(appointment.startTime);
  const isCancellable = appointment.status === 'PENDING_APPROVAL' || appointment.status === 'CONFIRMED';

  return (
    <div className="flex-1 max-w-[800px] w-full mx-auto px-6 sm:px-12 py-12">
      <Link href="/my-appointments" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent font-medium mb-8">
        <ArrowLeft size={18} /> Back to My Appointments
      </Link>

      <div className="bg-surface rounded-3xl border border-border-strong/60 shadow-sm overflow-hidden">
        
        {/* Header Section */}
        <div className={`p-8 md:p-10 border-b border-border-strong/50 ${appointment.status === 'PENDING_APPROVAL' ? 'bg-yellow-50/50' : appointment.status === 'CONFIRMED' ? 'bg-green-50/50' : 'bg-surface-muted'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="mb-2">
                <span className="text-sm font-bold text-text-secondary uppercase tracking-wider">
                  {appointment.status.replace('_', ' ')}
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-primary tracking-tight">{appointment.service?.name || 'Appointment'}</h1>
              <p className="text-lg text-text-secondary font-medium mt-1">{appointment.branch?.name || appointment.organization?.name || 'Business Partner'}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-border-strong shadow-sm text-center min-w-[140px]">
              <div className="text-text-secondary font-bold text-sm uppercase tracking-wider mb-1">{date.toLocaleString(undefined, { month: 'short' })}</div>
              <div className="text-4xl font-extrabold text-brand-navy">{date.getDate()}</div>
              <div className="text-primary font-semibold mt-1">{date.toLocaleString(undefined, { weekday: 'short' })}</div>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="p-8 md:p-10 flex flex-col gap-8">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Time</h3>
              <div className="flex items-center gap-2 font-semibold text-primary text-lg">
                <Clock size={20} className="text-accent" />
                {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            
            {appointment.service?.durationMins && (
              <div>
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Duration</h3>
                <div className="font-semibold text-primary text-lg">
                  {appointment.service.durationMins} minutes
                </div>
              </div>
            )}

            {(appointment.branch?.address || appointment.organization?.address) && (
              <div className="sm:col-span-2">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Location</h3>
                <div className="flex items-start gap-2 font-medium text-primary">
                  <MapPin size={20} className="text-accent shrink-0 mt-0.5" />
                  <span>{appointment.branch?.address || appointment.organization?.address}</span>
                </div>
              </div>
            )}

            {appointment.staff && (
              <div className="sm:col-span-2">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Assigned Professional</h3>
                <div className="font-medium text-primary">
                  {appointment.staff.user?.firstName} {appointment.staff.user?.lastName}
                </div>
              </div>
            )}
          </div>

          {appointment.customerNotes && (
            <div className="bg-surface-muted rounded-2xl p-6 border border-border-strong">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Your Notes</h3>
              <p className="text-primary">{appointment.customerNotes}</p>
            </div>
          )}

          {appointment.status === 'PENDING_APPROVAL' && (
            <div className="bg-blue-50 text-blue-800 p-5 rounded-2xl border border-blue-200 flex gap-3 items-start">
              <Info size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium">This request is pending approval by the business. You will be notified once it is confirmed and a professional is assigned.</p>
            </div>
          )}
          
          {appointment.status === 'REJECTED' && appointment.rejectionReason && (
            <div className="bg-red-50 text-red-800 p-5 rounded-2xl border border-red-200">
              <h3 className="font-bold mb-1">Reason for rejection:</h3>
              <p className="text-sm">{appointment.rejectionReason}</p>
            </div>
          )}

          {/* Cancellation Actions */}
          {isCancellable && (
            <div className="border-t border-border-strong/50 pt-8 mt-4">
              {!showCancel ? (
                <button 
                  onClick={() => setShowCancel(true)}
                  className="px-6 py-3 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors"
                >
                  Cancel Appointment
                </button>
              ) : (
                <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
                  <h3 className="font-bold text-red-800 mb-2">Are you sure you want to cancel?</h3>
                  <p className="text-red-700 text-sm mb-4">This action cannot be undone. Please provide a reason for the business.</p>
                  
                  <textarea 
                    className="w-full p-3 rounded-xl border border-red-200 mb-4 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                    placeholder="Reason for cancellation (optional)"
                    rows={2}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  
                  {cancelError && <div className="text-red-600 text-sm font-bold mb-4">{cancelError}</div>}
                  
                  <div className="flex gap-3">
                    <button 
                      disabled={cancelling}
                      onClick={handleCancel}
                      className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {cancelling && <Loader2 size={16} className="animate-spin" />}
                      Confirm Cancellation
                    </button>
                    <button 
                      disabled={cancelling}
                      onClick={() => setShowCancel(false)}
                      className="px-5 py-2.5 bg-white text-gray-700 font-bold rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Keep Appointment
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
