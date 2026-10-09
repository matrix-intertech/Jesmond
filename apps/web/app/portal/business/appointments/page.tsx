'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '@/utils/api';
import { getAccessToken, getCurrentUser } from '@/utils/auth';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { Loader2, Calendar, Clock, MapPin, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { canUseBusinessCapability } from '@/utils/capabilities';
import { useRouter } from 'next/navigation';

export default function BusinessAppointmentsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PENDING' | 'CALENDAR'>('OVERVIEW');
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  
  const [eligibleStaff, setEligibleStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/api/v1/business-appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch appointments');
      const data = await res.json();
      setAppointments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || !canUseBusinessCapability(user.businessCategory as any, 'APPOINTMENTS')) {
      router.replace('/portal');
      return;
    }
    fetchAppointments();
  }, [router]);

  const loadEligibleStaff = async (appointmentId: string) => {
    try {
      setLoadingStaff(true);
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/api/v1/business-appointments/${appointmentId}/eligible-staff`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load eligible staff');
      const data = await res.json();
      setEligibleStaff(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedStaffId || !selectedAppointment) return;
    try {
      setActionLoading(true);
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/api/v1/business-appointments/${selectedAppointment.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ staffId: selectedStaffId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to approve');
      }
      setSelectedAppointment(null);
      await fetchAppointments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAppointment) return;
    try {
      setActionLoading(true);
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/api/v1/business-appointments/${selectedAppointment.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectReason })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to reject');
      }
      setSelectedAppointment(null);
      setRejectReason('');
      await fetchAppointments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      setActionLoading(true);
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/api/v1/business-appointments/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update status');
      }
      await fetchAppointments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && appointments.length === 0) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-accent" size={32} /></div>;
  }
  if (error) {
    return <div className="p-6 bg-red-50 text-red-600 rounded-xl">{error}</div>;
  }

  const pendingRequests = appointments.filter(a => a.status === 'PENDING_APPROVAL');
  const confirmed = appointments.filter(a => a.status === 'CONFIRMED');
  const completed = appointments.filter(a => a.status === 'COMPLETED');
  
  const today = new Date();
  const todayAppointments = appointments.filter(a => {
    const d = new Date(a.startTime);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Appointments Dashboard" 
        description="Manage your business appointment requests and scheduling."
      />

      {/* Tabs */}
      <div className="flex border-b border-border-strong mb-6">
        {['OVERVIEW', 'PENDING', 'CALENDAR'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === tab ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-primary'}`}
          >
            {tab === 'PENDING' ? `Pending Requests (${pendingRequests.length})` : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Pending Approval" value={pendingRequests.length.toString()} icon={<AlertCircle size={20} />} />
            <StatCard label="Confirmed" value={confirmed.length.toString()} icon={<CheckCircle size={20} />} />
            <StatCard label="Today's Appointments" value={todayAppointments.length.toString()} icon={<Calendar size={20} />} />
            <StatCard label="Completed" value={completed.length.toString()} icon={<CheckCircle size={20} />} />
          </div>

          <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden">
            <div className="px-6 py-4 border-b border-border-strong bg-surface-muted">
              <h3 className="font-bold text-primary">Today's Schedule</h3>
            </div>
            <div className="divide-y divide-border-strong">
              {todayAppointments.length === 0 ? (
                <div className="p-8 text-center text-text-secondary">No appointments scheduled for today.</div>
              ) : (
                todayAppointments.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map(appt => (
                  <div key={appt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-muted/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-primary">{new Date(appt.startTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${appt.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : appt.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                          {appt.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="font-semibold text-primary">{appt.service?.name}</div>
                      <div className="text-sm text-text-secondary">Customer: {appt.customer?.firstName} {appt.customer?.lastName}</div>
                      {appt.staff && <div className="text-sm text-text-secondary mt-1 flex items-center gap-1"><MapPin size={12}/> {appt.staff.user?.firstName}</div>}
                    </div>
                    <div className="flex gap-2">
                      {appt.status === 'CONFIRMED' && (
                        <button onClick={() => handleStatusUpdate(appt.id, 'IN_PROGRESS')} disabled={actionLoading} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-100">Start</button>
                      )}
                      {appt.status === 'IN_PROGRESS' && (
                        <button onClick={() => handleStatusUpdate(appt.id, 'COMPLETED')} disabled={actionLoading} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-100">Complete</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PENDING TAB */}
      {activeTab === 'PENDING' && (
        <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden">
          <div className="px-6 py-4 border-b border-border-strong bg-surface-muted">
            <h3 className="font-bold text-primary">Pending Approvals</h3>
          </div>
          {pendingRequests.length === 0 ? (
            <div className="p-12 text-center text-text-secondary">
              <CheckCircle size={40} className="mx-auto mb-3 text-green-500 opacity-80" />
              <p>You're all caught up! No pending requests.</p>
            </div>
          ) : (
            <div className="divide-y divide-border-strong">
              {pendingRequests.map(req => (
                <div key={req.id} className="p-6 flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-primary">{req.service?.name}</h4>
                    <div className="flex items-center gap-2 mt-2 text-sm text-text-secondary font-medium">
                      <Calendar size={14} className="text-accent"/>
                      {new Date(req.startTime).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="mt-3 bg-surface-muted p-3 rounded-xl border border-border-strong/50 text-sm">
                      <span className="font-semibold text-primary">Customer:</span> {req.customer?.firstName} {req.customer?.lastName}
                      {req.customerNotes && <div className="mt-1 text-text-secondary italic">"{req.customerNotes}"</div>}
                    </div>
                  </div>
                  <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setSelectedAppointment(req);
                        loadEligibleStaff(req.id);
                      }}
                      className="w-full py-2 bg-brand-navy text-white rounded-lg font-bold hover:bg-brand-navy/90"
                    >
                      Review & Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CALENDAR TAB */}
      {activeTab === 'CALENDAR' && (
        <div className="bg-surface rounded-2xl border border-border-strong p-6">
          <h3 className="font-bold text-lg text-primary mb-6">Upcoming Schedule</h3>
          <div className="flex flex-col gap-3">
            {appointments.filter(a => !['PENDING_APPROVAL', 'CANCELLED', 'REJECTED'].includes(a.status)).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map(appt => {
              const d = new Date(appt.startTime);
              return (
                <div key={appt.id} className="p-4 border border-border-strong rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-surface-muted p-3 rounded-lg text-center min-w-[60px]">
                      <div className="text-xs font-bold text-text-secondary uppercase">{d.toLocaleString(undefined, { month: 'short' })}</div>
                      <div className="text-lg font-extrabold text-primary">{d.getDate()}</div>
                    </div>
                    <div>
                      <div className="font-bold text-primary">{appt.service?.name}</div>
                      <div className="text-sm text-text-secondary flex items-center gap-2 mt-1">
                        <Clock size={12}/> {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs ml-2">{appt.status}</span>
                      </div>
                    </div>
                  </div>
                  {appt.staff && (
                    <div className="hidden sm:block text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">
                      Assigned: {appt.staff.user?.firstName}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold text-primary mb-4">Review Request</h2>
            
            <div className="bg-surface-muted p-4 rounded-xl border border-border-strong mb-6">
              <div className="font-bold text-primary mb-1">{selectedAppointment.service?.name}</div>
              <div className="text-sm text-text-secondary mb-2">{new Date(selectedAppointment.startTime).toLocaleString()}</div>
              <div className="text-sm font-semibold">Customer: {selectedAppointment.customer?.firstName} {selectedAppointment.customer?.lastName}</div>
              {selectedAppointment.customerNotes && <div className="text-sm mt-2 italic text-text-secondary">"{selectedAppointment.customerNotes}"</div>}
            </div>

            <div className="mb-6">
              <h3 className="font-bold text-sm text-text-secondary uppercase tracking-wider mb-3">Assign Professional</h3>
              {loadingStaff ? (
                <div className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin"/> Checking availability...</div>
              ) : eligibleStaff.length === 0 ? (
                <div className="text-red-500 text-sm p-3 bg-red-50 rounded-lg">No staff are qualified for this service.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {eligibleStaff.map(staff => (
                    <label key={staff.staffId} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${!staff.isAvailable ? 'opacity-50 bg-gray-50 border-gray-200' : selectedStaffId === staff.staffId ? 'border-accent bg-accent/5' : 'border-border-strong hover:border-accent'}`}>
                      <input 
                        type="radio" 
                        name="staff" 
                        value={staff.staffId} 
                        disabled={!staff.isAvailable}
                        checked={selectedStaffId === staff.staffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-semibold text-primary">{staff.user?.firstName} {staff.user?.lastName}</div>
                        <div className="text-xs text-text-secondary">
                          {staff.isAvailable ? <span className="text-green-600 font-bold">Available</span> : <span className="text-red-500">{staff.reason}</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                disabled={!selectedStaffId || actionLoading}
                onClick={handleApprove}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 size={16} className="animate-spin" />} Approve & Assign
              </button>
              
              <div className="border-t border-border-strong my-2"></div>
              
              <input 
                type="text" 
                placeholder="Reason for rejection (optional)"
                className="w-full p-3 rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
              <button 
                disabled={actionLoading}
                onClick={handleReject}
                className="w-full py-3 bg-white text-red-600 border border-red-200 font-bold rounded-xl hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 size={16} className="animate-spin" />} Reject Request
              </button>
              
              <button 
                onClick={() => { setSelectedAppointment(null); setSelectedStaffId(''); setRejectReason(''); }}
                className="w-full py-3 mt-2 bg-transparent text-text-secondary font-bold hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
