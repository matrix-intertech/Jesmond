'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAccessToken, clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';

export default function PortalPropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProperties = async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        const data = await res.json();
        setProperties(data);
      } else {
        setError('Failed to fetch properties');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [router]);

  return (
    <>
      <PageHeader 
        title="My Properties" 
        description="Manage your accommodation listings" 
        primaryAction={{ label: 'Create Accommodation', href: '/portal/create' }} 
      />

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading...</div>
      ) : error ? (
        <div className="p-12 text-center text-red-600">{error}</div>
      ) : properties.length === 0 ? (
        <EmptyState title="No properties found." description="Get started by creating your first listing." />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface-muted border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-brand-navy">Property</th>
                <th className="px-6 py-4 text-sm font-medium text-brand-navy">Location</th>
                <th className="px-6 py-4 text-sm font-medium text-brand-navy">Status</th>
                <th className="px-6 py-4 text-sm font-medium text-brand-navy text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {properties.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <Link href={`/portal/properties/${p.id}`} className="font-medium text-brand-orange hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-brand-navy">{p.suburb?.name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/portal/properties/${p.id}`} className="text-sm text-brand-orange hover:underline">
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
