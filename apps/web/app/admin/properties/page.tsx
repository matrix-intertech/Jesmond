'use client';
import { clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { getAccessToken } from '@/utils/auth';

export default function AdminPropertiesPage() {
 const router = useRouter();
 const [properties, setProperties] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [activeTab, setActiveTab] = useState<'pending' | 'active'>('pending');

 const fetchProperties = async (tab: 'pending' | 'active') => {
 const token = getAccessToken();
 if (!token) return;

 setLoading(true);
 try {
 const endpoint = tab === 'pending' ? 'pending' : 'active';
 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/properties/${endpoint}`, {
 headers: { 'Authorization': `Bearer ${token}` }
 });
 const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
 if (status === 'ok') {
 const data = await res.json();
 setProperties(data);
 } else {
 setError(`Failed to fetch ${tab} properties`);
 }
 } catch (err: any) {
 setError(err.message);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchProperties(activeTab);
 }, [activeTab]);

 return (
 <>
 <PageHeader title="Properties" description="Manage property listings and submissions" />

 <div className="mb-6 flex gap-2 border-b border-border-strong">
 <button
 onClick={() => setActiveTab('pending')}
 className={`px-4 py-2 font-medium text-sm transition ${activeTab === 'pending' ? 'border-b-2 border-accent text-accent' : 'text-text-secondary hover:text-primary/90'}`}
 >
 For Review
 </button>
 <button
 onClick={() => setActiveTab('active')}
 className={`px-4 py-2 font-medium text-sm transition ${activeTab === 'active' ? 'border-b-2 border-accent text-accent' : 'text-text-secondary hover:text-primary/90'}`}
 >
 Active Listings
 </button>
 </div>

 {loading ? (
 <div className="p-12 text-center">Loading...</div>
 ) : error ? (
 <div className="p-12 text-center text-red-600">{error}</div>
 ) : (
 <>
 <div className="space-y-3 md:hidden">
 {properties.length === 0 ? (
 <div className="rounded-xl border bg-surface p-6 text-center text-text-secondary">
 {activeTab === 'pending' ? 'No properties pending approval.' : 'No active properties.'}
 </div>
 ) : (
 properties.map(p => (
 <div key={p.id} className="rounded-xl border bg-surface p-4 shadow-sm">
 <div className="min-w-0">
 <p className="font-semibold text-primary">{p.name}</p>
 <p className="mt-1 text-sm text-text-secondary">{p.organization.name}</p>
 <p className="mt-1 text-sm text-text-secondary">{p.suburb.name}</p>
 </div>
 {activeTab === 'active' && (
 <span className={`mt-3 inline-flex px-2 py-1 rounded-full text-xs font-medium ${p.status === 'PUBLISHED' ? 'bg-emerald-50 text-semantic-success' : 'bg-surface-muted text-primary/90'}`}>
 {p.status}
 </span>
 )}
 <a href={`/admin/properties/${p.id}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent">
 Review
 </a>
 </div>
 ))
 )}
 </div>

 <div className="hidden overflow-hidden rounded-xl border border-border-strong bg-surface shadow-sm md:block">
 <table className="w-full text-left">
 <thead className="bg-surface-muted border-b border-border-strong">
 <tr>
 <th className="px-6 py-4 text-sm font-medium text-primary">Property</th>
 <th className="px-6 py-4 text-sm font-medium text-primary">Provider</th>
 <th className="px-6 py-4 text-sm font-medium text-primary">Location</th>
 {activeTab === 'active' && (
 <th className="px-6 py-4 text-sm font-medium text-primary">Status</th>
 )}
 <th className="px-6 py-4 text-sm font-medium text-primary text-right">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200">
 {properties.length === 0 ? (
 <tr>
 <td colSpan={activeTab === 'active' ? 5 : 4} className="px-6 py-8 text-center text-text-secondary">
 {activeTab === 'pending' ? 'No properties pending approval.' : 'No active properties.'}
 </td>
 </tr>
 ) : (
 properties.map(p => (
 <tr key={p.id}>
 <td className="px-6 py-4 font-medium text-primary">{p.name}</td>
 <td className="px-6 py-4 text-sm text-primary">{p.organization.name}</td>
 <td className="px-6 py-4 text-sm text-primary">{p.suburb.name}</td>
 {activeTab === 'active' && (
 <td className="px-6 py-4 text-sm">
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'PUBLISHED' ? 'bg-emerald-50 text-semantic-success' : 'bg-surface-muted text-primary/90'}`}>
 {p.status}
 </span>
 </td>
 )}
 <td className="px-6 py-4 text-right">
 <a href={`/admin/properties/${p.id}`} className="text-accent font-medium text-sm hover:underline">
 Review →
 </a>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </>
 )}
 </>
 );
}
