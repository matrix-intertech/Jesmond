'use client';
import { clearAuth, getAccessToken } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import PageHeader from '@/components/ui/PageHeader';
import { SafeImage } from '@/components/ui/SafeImage';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function AdminPropertyReviewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectPrompt, setRejectPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchProperty = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/properties/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        const data = await res.json();
        setProperty(data);
      } else if (status === 'forbidden' || status === 'error') {
        setError('Failed to fetch property details');
      } else {
        setError('Failed to fetch property details');
      }
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
    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/properties/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        setSuccess('Approved successfully!');
        setTimeout(() => router.push('/admin/properties'), 1500);
      } else {
        setError('Failed to approve property');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReject = async () => {
    if (!rejectReason) return;
    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/properties/${id}/reject`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectReason })
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        setSuccess('Rejected successfully!');
        setTimeout(() => router.push('/admin/properties'), 1500);
      } else {
        setError('Failed to reject property');
      }
    } catch (err: any) {
      setError(err.message);
      setRejectPrompt(false);
    }
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (error) return <div className="p-12 text-center text-red-600">{error}</div>;
  if (!property) return null;

  const isPending = property.status === 'PENDING_APPROVAL';

  return (
    <>
      <PageHeader title="Property Review" description="Review and approve property submissions" onBack={() => router.push('/admin/properties')} />
      <div className="max-w-5xl mx-auto py-6">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-medium text-slate-900 font-outfit mb-2">{property.name}</h1>
            <p className="text-gray-600 mb-1">Provider: <strong>{property.organization.name}</strong></p>
            <p className="text-gray-600">{property.address}, {property.suburb.name}</p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              {property.status}
            </span>
            {isPending && (
              <div className="flex gap-2 relative">
                <button onClick={() => setRejectPrompt(true)} className="bg-red-50 text-red-700 px-4 py-2 rounded-md hover:bg-red-100 text-sm font-medium">
                  Reject
                </button>
                <button onClick={handleApprove} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium">
                  Approve & Publish
                </button>
                {rejectPrompt && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border shadow-lg rounded-xl p-4 z-10">
                    <h3 className="font-semibold text-sm mb-2">Reason for rejection</h3>
                    <textarea 
                      className="w-full border rounded p-2 text-sm mb-3"
                      placeholder="Will be saved in audit log"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setRejectPrompt(false)} className="text-xs px-3 py-1 text-gray-600">Cancel</button>
                      <button onClick={handleReject} className="text-xs px-3 py-1 bg-red-600 text-white rounded">Confirm Reject</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {success && <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 font-semibold">{success}</div>}
        {error && <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6 font-semibold">{error}</div>}

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
                  <SafeImage src={m.url} alt="Property" className="object-cover w-full h-full" width={128} height={128} />
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
                      <p className="text-sm text-gray-600">{room.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${(room.pricePerWeek / 100).toFixed(2)}/wk</div>
                      <div className="text-sm text-gray-600">Inv: {room.inventory}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
