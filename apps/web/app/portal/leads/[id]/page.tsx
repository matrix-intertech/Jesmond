"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, getCurrentUser, clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { ArrowLeft, User, Building, Clock, Activity, Users } from 'lucide-react';
import Link from 'next/link';

export default function LeadDetailPage({ params }: { params: { id: string } }) {
 const router = useRouter();
 const [lead, setLead] = useState<any>(null);
 const [teamMembers, setTeamMembers] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [currentUser, setCurrentUser] = useState<any>(null);
 const [saving, setSaving] = useState(false);
 const [assignError, setAssignError] = useState('');

 // local state for editing
 const [status, setStatus] = useState('');
 const [temperature, setTemperature] = useState('');
 const [assignedTo, setAssignedTo] = useState('');

 const fetchLead = async (token: string) => {
 try {
 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/leads/my/${params.id}`, {
 headers: { Authorization: `Bearer ${token}` }
 });
 const resStatus = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
 if (resStatus === 'ok') {
 const data = await res.json();
 setLead(data);
 setStatus(data.status);
 setTemperature(data.temperature);
 if (data.assignments && data.assignments.length > 0) {
 setAssignedTo(data.assignments[0].orgStaffId);
 }
 } else {
 const errText = await res.text();
 setError(errText || 'Failed to fetch lead');
 }
 } catch (err: any) {
 setError(err.message || 'Error fetching lead');
 }
 };

 const fetchTeamMembers = async (token: string) => {
 try {
 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/agency/my/members`, {
 headers: { Authorization: `Bearer ${token}` }
 });
 if (res.ok) {
 setTeamMembers(await res.json());
 }
 } catch (e) {
 console.error(e);
 }
 };

 useEffect(() => {
 const user = getCurrentUser();
 setCurrentUser(user);
 const token = getAccessToken();
 if (token) {
 setLoading(true);
 Promise.all([fetchLead(token), fetchTeamMembers(token)]).finally(() => setLoading(false));
 }
 }, [params.id, router]);

 const handleUpdate = async () => {
 const token = getAccessToken();
 if (!token) return;

 setSaving(true);
 setAssignError('');
 try {
 // Update status/temp
 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/leads/my/${params.id}`, {
 method: 'PATCH',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`
 },
 body: JSON.stringify({ status, temperature })
 });

 if (!res.ok) {
 throw new Error(await res.text());
 }

 // If user is admin and changed assignment
 const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.orgRole === 'ADMIN' || currentUser?.agencyRole === 'AGENCY_ADMIN';
 if (isAdmin) {
 const assignRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/leads/my/${params.id}/assign`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`
 },
 body: JSON.stringify({ targetStaffId: assignedTo || null })
 });
 if (!assignRes.ok) {
 throw new Error(await assignRes.text());
 }
 }

 // Refetch
 await fetchLead(token);
 } catch (e: any) {
 setAssignError(e.message || 'Error updating lead');
 } finally {
 setSaving(false);
 }
 };

 if (loading) return <div className="p-12 text-center text-text-secondary">Loading...</div>;
 if (error || !lead) return <div className="p-12 text-center text-red-600">{error || 'Lead not found'}</div>;

 const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.orgRole === 'ADMIN' || currentUser?.agencyRole === 'AGENCY_ADMIN';

 // Can manage check (simplified for UI, server enforces strictly)
 // Assume if they can see it, they either manage the property, are assigned, or are admin.
 // We'll allow them to try update; server will reject if VIEW only.
 const canManage = true;

 return (
 <>
 <div className="mb-4">
 <Link href="/portal/leads" className="text-sm text-primary hover:text-accent flex items-center">
 <ArrowLeft className="h-4 w-4 mr-1" /> Back to Leads
 </Link>
 </div>

 <PageHeader
 title="Lead Details"
 description={`Lead from ${lead.sourceType === 'PROPERTY_PAGE' ? 'Property Page' : 'Agency Page'}`}
 />

 {assignError && (
 <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
 {assignError}
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="md:col-span-2 space-y-6">
 <div className="bg-surface rounded-xl shadow-sm border border-border-strong p-6">
 <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
 <User className="h-5 w-5 mr-2 text-text-muted" /> Visitor Information
 </h3>
 {lead.user ? (
 <div className="space-y-3">
 <p><span className="text-text-secondary w-32 inline-block">Name:</span> <span className="font-medium">{lead.user.firstName} {lead.user.lastName}</span></p>
 <p><span className="text-text-secondary w-32 inline-block">Email:</span> <span>{lead.user.email}</span></p>
 </div>
 ) : (
 <p className="text-text-secondary italic">Anonymous Visitor (Session Tracking Only)</p>
 )}
 </div>

 <div className="bg-surface rounded-xl shadow-sm border border-border-strong p-6">
 <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
 <Activity className="h-5 w-5 mr-2 text-text-muted" /> Activity
 </h3>
 <div className="space-y-3 text-sm">
 <p><span className="text-text-secondary w-32 inline-block">First Visit:</span> <span>{new Date(lead.firstVisitedAt).toLocaleString()}</span></p>
 <p><span className="text-text-secondary w-32 inline-block">Last Visit:</span> <span>{new Date(lead.lastVisitedAt).toLocaleString()}</span></p>
 <p><span className="text-text-secondary w-32 inline-block">Total Visits:</span> <span>{lead.visitCount}</span></p>
 <p><span className="text-text-secondary w-32 inline-block">Property:</span> <span>{lead.property ? lead.property.name : 'N/A (Agency Page)'}</span></p>
 </div>
 </div>
 </div>

 <div className="space-y-6">
 <div className="bg-surface rounded-xl shadow-sm border border-border-strong p-6">
 <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
 <Building className="h-5 w-5 mr-2 text-text-muted" /> Management
 </h3>

 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-text-primary mb-1">Status</label>
 <select
 value={status}
 onChange={e => setStatus(e.target.value)}
 disabled={!canManage || saving}
 className="w-full rounded-md border border-border-strong p-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-surface-muted"
 >
 <option value="NEW">New</option>
 <option value="CONTACTED">Contacted</option>
 <option value="FOLLOW_UP">Follow Up</option>
 <option value="QUALIFIED">Qualified</option>
 <option value="APPLICATION_STARTED">Application Started</option>
 <option value="CONVERTED">Converted</option>
 <option value="LOST">Lost</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-text-primary mb-1">Temperature</label>
 <select
 value={temperature}
 onChange={e => setTemperature(e.target.value)}
 disabled={!canManage || saving}
 className="w-full rounded-md border border-border-strong p-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-surface-muted"
 >
 <option value="COLD">Cold</option>
 <option value="WARM">Warm</option>
 <option value="HOT">Hot</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-text-primary mb-1 flex items-center">
 <Users className="h-4 w-4 mr-1 text-text-muted" /> Assigned To
 </label>
 {isAdmin ? (
 <select
 value={assignedTo}
 onChange={e => setAssignedTo(e.target.value)}
 disabled={saving}
 className="w-full rounded-md border border-border-strong p-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-surface-muted"
 >
 <option value="">Unassigned</option>
 {teamMembers.map(m => (
 <option key={m.id} value={m.id}>{m.user.firstName} {m.user.lastName}</option>
 ))}
 </select>
 ) : (
 <div className="p-2 bg-surface-lavender border border-border-strong rounded-md text-sm text-text-primary">
 {lead.assignments && lead.assignments.length > 0
 ? `${lead.assignments[0].orgStaff?.user?.firstName} ${lead.assignments[0].orgStaff?.user?.lastName}`
 : 'Unassigned'}
 </div>
 )}
 </div>

 {canManage && (
 <button
 onClick={handleUpdate}
 disabled={saving || (status === lead.status && temperature === lead.temperature && (lead.assignments?.[0]?.orgStaffId || '') === assignedTo)}
 className="w-full mt-4 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {saving ? 'Saving...' : 'Save Changes'}
 </button>
 )}
 </div>
 </div>
 </div>
 </div>
 </>
 );
}
