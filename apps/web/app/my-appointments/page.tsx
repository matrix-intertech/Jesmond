'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '@/utils/api';
import { getAccessToken, isAuthenticated } from '@/utils/auth';
import { Calendar, Loader2, ArrowRight, Clock, MapPin, XCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MyAppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login?redirect=/my-appointments');
      return;
    }

    async function fetchAppointments() {
      try {
        const token = getAccessToken();
        const res = await fetch(`${getApiUrl()}/api/v1/appointments/my`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login?redirect=/my-appointments');
            return;
          }
          throw new Error('Failed to load appointments');
        }
        const data = await res.json();
        setAppointments(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAppointments();
  }, [router]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold uppercase tracking-wider rounded-full border border-yellow-200">Pending</span>;
      case 'CONFIRMED':
        return <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold uppercase tracking-wider rounded-full border border-green-200 flex items-center gap-1"><CheckCircle size={12}/> Confirmed</span>;
      case 'IN_PROGRESS':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider rounded-full border border-blue-200">In Progress</span>;
      case 'COMPLETED':
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-full border border-gray-200">Completed</span>;
      case 'CANCELLED':
      case 'REJECTED':
      case 'NO_SHOW':
        return <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider rounded-full border border-red-200 flex items-center gap-1"><XCircle size={12}/> {status.replace('_', ' ')}</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-full border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="flex-1 max-w-[1000px] w-full mx-auto px-6 sm:px-12 lg:px-16 py-12">
      <h1 className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight mb-8">My Appointments</h1>

      {loading ? (
        <div className="flex items-center justify-center p-20 bg-surface rounded-3xl border border-border-strong/60 shadow-sm">
          <Loader2 className="animate-spin text-accent" size={40} />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-100 text-center shadow-sm">
          <p className="font-bold mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold">Retry</button>
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-surface rounded-3xl p-16 text-center border border-border-strong/60 shadow-sm">
          <Calendar size={64} className="mx-auto text-brand-purple mb-6 opacity-80" />
          <h2 className="text-2xl font-bold text-primary">No appointments yet</h2>
          <p className="text-text-secondary mt-3 max-w-md mx-auto text-lg">You haven't booked any appointments. Explore our businesses to schedule a service.</p>
          <Link href="/businesses" className="mt-8 inline-block px-8 py-3 bg-brand-navy text-white font-bold rounded-xl shadow-lg hover:bg-brand-navy/90 transition-all">
            Browse Businesses
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {appointments.map((appt) => {
            const date = new Date(appt.startTime);
            const isUpcoming = date > new Date() && !['CANCELLED', 'REJECTED', 'COMPLETED', 'NO_SHOW'].includes(appt.status);
            
            return (
              <Link 
                href={`/my-appointments/${appt.id}`} 
                key={appt.id}
                className={`bg-surface rounded-3xl p-6 md:p-8 border ${isUpcoming ? 'border-accent/40 shadow-md hover:border-accent hover:shadow-lg' : 'border-border-strong hover:border-text-secondary/50 shadow-sm'} transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group`}
              >
                <div className="flex items-start gap-5 flex-1">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${isUpcoming ? 'bg-accent/10 text-accent' : 'bg-surface-muted text-text-secondary'}`}>
                    <Calendar size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-xl text-primary">{appt.service?.name || 'Service Appointment'}</h3>
                      {getStatusBadge(appt.status)}
                    </div>
                    
                    <p className="text-text-secondary font-medium">{appt.branch?.name || appt.organization?.name || 'Jesmond Partner'}</p>
                    
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-text-secondary">
                      <div className="flex items-center gap-1.5 font-semibold text-primary">
                        <Clock size={16} className="text-accent" />
                        {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="md:pl-6 md:border-l border-border-strong/50 flex items-center shrink-0">
                  <span className="text-accent font-bold group-hover:translate-x-1 transition-transform flex items-center gap-2">
                    View Details <ArrowRight size={18} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
