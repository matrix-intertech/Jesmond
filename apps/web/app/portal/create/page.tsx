'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import PageHeader from '@/components/ui/PageHeader';
import { getAccessToken, getCurrentUser, clearAuth } from '@/utils/auth';

export default function CreatePropertyPage() {
  const router = useRouter();
  const [suburbs, setSuburbs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    suburbId: '',
    postcode: '',
    lat: '',
    lng: '',
    description: '',
  });

  useEffect(() => {
    const token = getAccessToken();
    const currentUser = getCurrentUser();
    if (!token || !currentUser || currentUser.role !== 'PROVIDER') {
      if (!currentUser) clearAuth();
      router.push(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' ? '/admin' : currentUser?.role === 'STUDENT' ? '/student' : '/login');
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/suburbs`)
      .then(res => res.json())
      .then(data => setSuburbs(data))
      .catch(console.error);
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Failed to create property');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/portal');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-2">Accommodation Created Successfully</h2>
          <p className="text-gray-500">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell role="PROVIDER">
      <PageHeader title="Create Accommodation" onBack={() => router.push('/portal')} />
      <div className="max-w-[800px] mx-auto py-12">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
            <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="e.g., Unilodge Melbourne" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input required type="text" name="address" value={formData.address} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="123 Example Street" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City / Suburb</label>
              <select required name="suburbId" value={formData.suburbId} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2">
                <option value="">Select Suburb</option>
                {suburbs.map(s => (
                  <option key={s.id} value={s.id}>{s.name}, {s.city.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
              <input required type="text" name="postcode" value={formData.postcode} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input required type="number" step="any" name="lat" value={formData.lat} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="-37.8136" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input required type="number" step="any" name="lng" value={formData.lng} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="144.9631" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea required name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Describe the accommodation..."></textarea>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
