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

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-medium text-sm transition ${activeTab === 'pending' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
        >
          For Review
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-medium text-sm transition ${activeTab === 'active' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
        >
          Active Listings
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center">Loading...</div>
      ) : error ? (
        <div className="p-12 text-center text-red-600">{error}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-slate-900">Property</th>
                <th className="px-6 py-4 text-sm font-medium text-slate-900">Provider</th>
                <th className="px-6 py-4 text-sm font-medium text-slate-900">Location</th>
                {activeTab === 'active' && (
                  <th className="px-6 py-4 text-sm font-medium text-slate-900">Status</th>
                )}
                <th className="px-6 py-4 text-sm font-medium text-slate-900 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {properties.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'active' ? 5 : 4} className="px-6 py-8 text-center text-slate-600">
                    {activeTab === 'pending' ? 'No properties pending approval.' : 'No active properties.'}
                  </td>
                </tr>
              ) : (
                properties.map(p => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{p.organization.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{p.suburb.name}</td>
                    {activeTab === 'active' && (
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {p.status}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <a href={`/admin/properties/${p.id}`} className="text-indigo-600 font-medium text-sm hover:underline">
                        Review →
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
