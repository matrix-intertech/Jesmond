'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { GlobalNav } from "@/components/marketing/GlobalNav";

export default function AdminPropertyReviewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProperty = async () => {
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/properties/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch property details');
      const data = await res.json();
      setProperty(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperty();
  }, [id]);

  const handleApprove = async () => {
    if (!confirm('Approve and publish this property?')) return;
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/properties/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Approved!');
      router.push('/admin/properties');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Reason for rejection? (Will be saved in audit log)');
    if (reason === null) return;
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/properties/${id}/reject`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Rejected!');
      router.push('/admin/properties');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (error) return <div className="p-12 text-center text-red-600">{error}</div>;
  if (!property) return null;

  const isPending = property.status === 'PENDING_APPROVAL';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <GlobalNav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-medium text-slate-900 font-outfit mb-2">{property.name}</h1>
            <p className="text-gray-500 mb-1">Provider: <strong>{property.organization.name}</strong></p>
            <p className="text-gray-500">{property.address}, {property.suburb.name}</p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              {property.status}
            </span>
            {isPending && (
              <div className="flex gap-2">
                <button onClick={handleReject} className="bg-red-50 text-red-700 px-4 py-2 rounded-md hover:bg-red-100 text-sm font-medium">
                  Reject
                </button>
                <button onClick={handleApprove} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium">
                  Approve & Publish
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-medium mb-4">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{property.description}</p>
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-medium mb-4">Images ({property.media.length})</h2>
            <div className="flex flex-wrap gap-4">
              {property.media.map((m: any) => (
                <div key={m.id} className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
                  <img src={m.url} alt="Property" className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-medium mb-4">Room Types ({property.roomTypes.length})</h2>
            <div className="space-y-4">
              {property.roomTypes.map((room: any) => (
                <div key={room.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between">
                    <div>
                      <h3 className="font-medium">{room.name}</h3>
                      <p className="text-sm text-gray-500">{room.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${(room.pricePerWeek / 100).toFixed(2)}/wk</div>
                      <div className="text-sm text-gray-500">Inv: {room.inventory}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
