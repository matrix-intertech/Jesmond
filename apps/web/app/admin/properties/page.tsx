'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlobalNav } from "@/components/marketing/GlobalNav";

export default function AdminPendingPropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPending = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/properties/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error('Unauthorized or not an admin');
      }
      if (!res.ok) throw new Error('Failed to fetch pending properties');
      const data = await res.json();
      setProperties(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (error) return <div className="p-12 text-center text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <GlobalNav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-medium text-slate-900 font-outfit mb-8">Pending Properties</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">Property</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">Provider</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">Location</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {properties.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No properties pending approval.
                  </td>
                </tr>
              ) : (
                properties.map(p => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 font-medium">{p.name}</td>
                    <td className="px-6 py-4 text-sm">{p.organization.name}</td>
                    <td className="px-6 py-4 text-sm">{p.suburb.name}</td>
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
      </main>
    </div>
  );
}
