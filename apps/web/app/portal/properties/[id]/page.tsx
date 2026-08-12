'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { GlobalNav } from "../../../../components/marketing/GlobalNav";

export default function AccommodationManagementPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Forms
  const [newRoom, setNewRoom] = useState({ name: '', description: '', price: '', inventory: '' });
  const [availDate, setAvailDate] = useState('');
  const [availCount, setAvailCount] = useState('');

  const fetchProperty = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch property');
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem('access_token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Upload failed');
      }
      fetchProperty();
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/rooms`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newRoom.name,
          description: newRoom.description,
          pricePerWeek: Math.round(parseFloat(newRoom.price) * 100), // convert to cents
          inventory: parseInt(newRoom.inventory)
        })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(Array.isArray(err.message) ? err.message.join(', ') : err.message);
        return;
      }
      setNewRoom({ name: '', description: '', price: '', inventory: '' });
      fetchProperty();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateAvailability = async (roomId: string) => {
    if (!availDate || !availCount) return alert('Date and count required');
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/rooms/${roomId}/availability`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: availDate,
          available: parseInt(availCount)
        })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(Array.isArray(err.message) ? err.message.join(', ') : err.message);
        return;
      }
      setAvailDate('');
      setAvailCount('');
      fetchProperty();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitReview = async () => {
    if (!confirm('Submit this property for review? You will not be able to edit it while pending.')) return;
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message);
        return;
      }
      alert('Property submitted for review!');
      fetchProperty();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (error) return <div className="p-12 text-center text-red-600">{error}</div>;
  if (!property) return null;

  const isPending = property.status === 'PENDING_APPROVAL';
  const isPublished = property.status === 'PUBLISHED';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <GlobalNav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-medium text-slate-900 font-outfit">{property.name}</h1>
            <p className="text-gray-500">{property.address}, {property.suburb.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              {property.status}
            </span>
            {property.status === 'DRAFT' && (
              <button onClick={handleSubmitReview} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm">
                Submit for Review
              </button>
            )}
            {isPublished && (
              <a href={`/property/${property.id}`} target="_blank" className="text-indigo-600 text-sm hover:underline">
                View Public Listing
              </a>
            )}
          </div>
        </div>
        
        {isPending && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-8">
            <h3 className="font-medium">Awaiting Admin Approval</h3>
            <p className="text-sm">This property is currently being reviewed by administrators. Editing is disabled until a decision is made.</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Images Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-medium mb-4">Images</h2>
            <div className="flex flex-wrap gap-4 mb-4">
              {property.media.map((m: any) => (
                <div key={m.id} className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <img src={m.url} alt="Property" className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
            {!isPending && (
              <div>
                <label className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md cursor-pointer hover:bg-indigo-100 transition inline-block">
                  <span>+ Upload Image</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isPending} />
                </label>
                <p className="text-xs text-gray-400 mt-2">Note: S3 storage must be configured to upload real images.</p>
              </div>
            )}
          </section>

          {/* Rooms Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-medium mb-4">Room Types</h2>
            <div className="space-y-4 mb-8">
              {property.roomTypes.length === 0 ? (
                <p className="text-gray-500 text-sm">No room types added yet.</p>
              ) : (
                property.roomTypes.map((room: any) => (
                  <div key={room.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-medium text-gray-900">{room.name}</h3>
                        <p className="text-sm text-gray-500">{room.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-lg">${(room.pricePerWeek / 100).toFixed(2)}/wk</div>
                        <div className="text-sm text-gray-500">Inventory: {room.inventory}</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h4 className="text-sm font-medium mb-2">Update Availability</h4>
                      <div className="flex gap-2">
                        <input type="date" value={availDate} onChange={e => setAvailDate(e.target.value)} disabled={isPending} className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100" />
                        <input type="number" value={availCount} onChange={e => setAvailCount(e.target.value)} disabled={isPending} placeholder="Avail Count" className="border border-gray-300 rounded px-2 py-1 text-sm w-32 disabled:bg-gray-100" />
                        <button onClick={() => handleUpdateAvailability(room.id)} disabled={isPending} className="bg-indigo-600 text-white px-3 py-1 text-sm rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Set</button>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-2">
                        {room.availabilityCalendar.map((cal: any) => (
                          <span key={cal.date} className="bg-gray-100 px-2 py-1 rounded">
                            {new Date(cal.date).toLocaleDateString()}: {cal.available}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {!isPending && (
              <form onSubmit={handleCreateRoom} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium mb-4">Add New Room Type</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input required type="text" placeholder="Name (e.g. Standard Studio)" value={newRoom.name} onChange={e => setNewRoom({...newRoom, name: e.target.value})} className="border border-gray-300 rounded-md px-3 py-2" />
                  <input type="text" placeholder="Description" value={newRoom.description} onChange={e => setNewRoom({...newRoom, description: e.target.value})} className="border border-gray-300 rounded-md px-3 py-2" />
                  <input required type="number" step="0.01" min="1" placeholder="Weekly Price ($)" value={newRoom.price} onChange={e => setNewRoom({...newRoom, price: e.target.value})} className="border border-gray-300 rounded-md px-3 py-2" />
                  <input required type="number" min="0" placeholder="Total Inventory" value={newRoom.inventory} onChange={e => setNewRoom({...newRoom, inventory: e.target.value})} className="border border-gray-300 rounded-md px-3 py-2" />
                </div>
                <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 text-sm">
                  Save Room Type
                </button>
              </form>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
