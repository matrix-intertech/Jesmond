"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, getCurrentUser, clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { RefreshCw, Users, Activity, Target } from 'lucide-react';
import Link from 'next/link';

export default function PortalLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const fetchLeads = async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/leads/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        const data = await res.json();
        setLeads(data.items || []);
      } else {
        const errText = await res.text();
        setError(errText || 'Failed to fetch leads');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    fetchLeads();
  }, [router]);

  return (
    <>
      <PageHeader 
        title="My Leads" 
        description="Manage your property and agency leads" 
      />

      {loading ? (
        <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center">
          <RefreshCw className="animate-spin h-8 w-8 text-brand-orange mb-4" />
          <p>Loading leads...</p>
        </div>
      ) : error ? (
        <div className="p-12 text-center text-red-600 border border-red-200 bg-red-50 rounded-xl">
          <p className="font-semibold mb-2">Error</p>
          <p>{error}</p>
          <button onClick={fetchLeads} className="mt-4 underline">Try Again</button>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState 
          title="No leads found." 
          description="Leads generated from your properties and agency page will appear here." 
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 font-medium">Total Leads</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{leads.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 font-medium">New Leads</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{leads.filter(l => l.status === 'NEW').length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 font-medium">Warm / Hot</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{leads.filter(l => l.temperature === 'WARM' || l.temperature === 'HOT').length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 font-medium">Converted</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{leads.filter(l => l.status === 'CONVERTED').length}</p>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
            <table className="w-full text-left">
              <thead className="bg-surface-muted border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-brand-navy">Visitor</th>
                  <th className="px-6 py-4 text-sm font-medium text-brand-navy">Source</th>
                  <th className="px-6 py-4 text-sm font-medium text-brand-navy">Property</th>
                  <th className="px-6 py-4 text-sm font-medium text-brand-navy">Status</th>
                  <th className="px-6 py-4 text-sm font-medium text-brand-navy">Assigned To</th>
                  <th className="px-6 py-4 text-sm font-medium text-brand-navy text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      {lead.user ? (
                        <div>
                          <p className="font-medium text-gray-900">{lead.user.firstName} {lead.user.lastName}</p>
                          <p className="text-xs text-gray-500">{lead.user.email}</p>
                        </div>
                      ) : (
                        <p className="font-medium text-gray-600">Anonymous Visitor</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        lead.sourceType === 'PROPERTY_PAGE' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {lead.sourceType === 'PROPERTY_PAGE' ? 'Property Page' : 'Agency Page'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {lead.property ? lead.property.name : <span className="text-gray-400 italic">Agency General</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={lead.status} />
                        <span className={`text-xs font-semibold ${
                          lead.temperature === 'HOT' ? 'text-red-600' :
                          lead.temperature === 'WARM' ? 'text-orange-500' : 'text-blue-500'
                        }`}>
                          {lead.temperature}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {lead.assignments && lead.assignments.length > 0 ? (
                        <div className="flex -space-x-1 overflow-hidden">
                          {lead.assignments.map((a: any) => (
                            <div key={a.id} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600" title={`${a.orgStaff?.user?.firstName} ${a.orgStaff?.user?.lastName}`}>
                              {a.orgStaff?.user?.firstName?.[0]}{a.orgStaff?.user?.lastName?.[0]}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/portal/leads/${lead.id}`} className="text-sm font-medium text-brand-orange hover:underline">
                        View Lead →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="space-y-3 md:hidden">
            {leads.map(lead => (
              <div key={lead.id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    {lead.user ? (
                      <p className="font-semibold text-gray-900">{lead.user.firstName} {lead.user.lastName}</p>
                    ) : (
                      <p className="font-semibold text-gray-600">Anonymous Visitor</p>
                    )}
                    <p className="text-xs text-gray-500">{lead.property ? lead.property.name : 'Agency General'}</p>
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-semibold ${
                          lead.temperature === 'HOT' ? 'text-red-600' :
                          lead.temperature === 'WARM' ? 'text-orange-500' : 'text-blue-500'
                        }`}>
                    {lead.temperature}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-gray-500">{new Date(lead.lastVisitedAt).toLocaleDateString()}</span>
                </div>
                <Link href={`/portal/leads/${lead.id}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand-orange px-4 py-2 text-sm font-semibold text-brand-orange">
                  View Lead
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
