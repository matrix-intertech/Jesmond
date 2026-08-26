'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

import { SafeImage } from '../../../../components/ui/SafeImage';
import PageHeader from '@/components/ui/PageHeader';
import { getAccessToken, clearAuth } from '@/utils/auth';

import { handleApiError } from '@/utils/api';
import HierarchyManager from './HierarchyManager';

export default function AccommodationManagementPage() {
  const router = useRouter();
  const onAuthError = () => { clearAuth(); router.replace('/login'); };
  const params = useParams();
  const id = params.id as string;
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [submitConfirm, setSubmitConfirm] = useState(false);

  // Forms
  const [newRoom, setNewRoom] = useState({ name: '', description: '', price: '', inventory: '' });
  const [availDate, setAvailDate] = useState('');
  const [availCount, setAvailCount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingProp, setIsEditingProp] = useState(false);
  const [editPropForm, setEditPropForm] = useState({ name: '', address: '', postcode: '', lat: '', lng: '', description: '' });
  const [allAmenities, setAllAmenities] = useState<any[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [isEditingAmenities, setIsEditingAmenities] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/amenities`)
      .then(res => res.json())
      .then(data => setAllAmenities(data))
      .catch(err => console.log('Failed to load amenities. Ensure API is running.', err.message));
  }, []);

  const fetchProperty = async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        const data = await res.json();
        setProperty(data);
        setEditPropForm({
          name: data.name, address: data.address, postcode: data.postcode,
          lat: data.lat, lng: data.lng, description: data.description
        });
        setSelectedAmenities(data.amenities?.map((a: any) => a.amenityId) || []);
      } else {
        setError('Failed to fetch property');
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = getAccessToken();
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setToast('Image uploaded successfully');
        setTimeout(() => setToast(''), 3000);
      } else {
        const err = await res.json();
        setError(err.message || 'Upload failed');
      }
      fetchProperty();
    } catch (err) {
      console.error(err);
      setError('Upload failed');
    }
  };

  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editPropForm,
          lat: parseFloat(editPropForm.lat),
          lng: parseFloat(editPropForm.lng),
        })
      });
      if (await handleApiError(res, onAuthError) === 'ok') {
        setToast('Property updated successfully');
        setIsEditingProp(false);
        fetchProperty();
      } else {
        setError((await res.json()).message || 'Update failed');
      }
    } catch (err) { setError('Update failed'); } finally { setIsSubmitting(false); }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room type?')) return;
    const token = getAccessToken();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (await handleApiError(res, onAuthError) === 'ok') {
        setToast('Room deleted successfully');
        fetchProperty();
      } else {
        setError((await res.json()).message || 'Delete failed');
      }
    } catch (err) { setError('Delete failed'); } finally { setIsSubmitting(false); }
  };

  const handleUpdateAmenities = async () => {
    const token = getAccessToken();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/amenities`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amenities: selectedAmenities })
      });
      if (await handleApiError(res, onAuthError) === 'ok') {
        setToast('Amenities updated');
        setIsEditingAmenities(false);
        fetchProperty();
      } else {
        setError((await res.json()).message || 'Failed to update amenities');
      }
    } catch (err) { setError('Failed to update amenities'); } finally { setIsSubmitting(false); }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    setIsSubmitting(true);
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
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setNewRoom({ name: '', description: '', price: '', inventory: '' });
        setToast('Room created successfully');
        setTimeout(() => setToast(''), 3000);
        fetchProperty();
      } else {
        const err = await res.json();
        setError(Array.isArray(err.message) ? err.message.join(', ') : err.message);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to create room');
    } finally { setIsSubmitting(false); }
  };

  const handleUpdateAvailability = async (roomId: string) => {
    if (!availDate || !availCount) return setError('Date and count required');
    const token = getAccessToken();
    setIsSubmitting(true);
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
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setAvailDate('');
        setAvailCount('');
        setToast('Availability updated');
        setTimeout(() => setToast(''), 3000);
        fetchProperty();
      } else {
        const err = await res.json();
        setError(Array.isArray(err.message) ? err.message.join(', ') : err.message);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to update availability');
    } finally { setIsSubmitting(false); }
  };

  const handleSubmitReview = async () => {
    const token = getAccessToken();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setToast('Property submitted for review!');
        setSubmitConfirm(false);
        setTimeout(() => setToast(''), 3000);
        fetchProperty();
      } else {
        const err = await res.json();
        setError(err.message);
        setSubmitConfirm(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to submit');
      setSubmitConfirm(false);
    } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (error) return <div className="p-12 text-center text-red-600">{error}</div>;
  if (!property) return null;

  const isPending = property.status === 'PENDING_APPROVAL';
  const isPublished = property.status === 'PUBLISHED';

  return (
    <>
      <PageHeader title={property.name} description={`${property.address}, ${property.suburb.name}`} onBack={() => router.push('/portal')} />
      <div className="max-w-5xl mx-auto py-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-medium text-brand-navy font-outfit">{property.name}</h1>
            <p className="text-gray-500">{property.address}, {property.suburb.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              {property.status}
            </span>
            {property.status === 'DRAFT' && !isEditingProp && (
              <button onClick={() => setIsEditingProp(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-surface-muted text-sm">
                Edit Details
              </button>
            )}
            {property.status === 'DRAFT' && (
              <div className="relative">
                <button disabled={isSubmitting} onClick={() => setSubmitConfirm(true)} className="bg-brand-orange text-white px-4 py-2 rounded-md hover:bg-orange-600 text-sm disabled:opacity-50">
                  Submit for Review
                </button>
                {submitConfirm && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border shadow-lg rounded-xl p-4 z-10">
                    <h3 className="font-semibold text-sm mb-2">Submit for Review?</h3>
                    <p className="text-xs text-gray-600 mb-4">You will not be able to edit it while pending.</p>
                    <div className="flex gap-2 justify-end">
                      <button disabled={isSubmitting} onClick={() => setSubmitConfirm(false)} className="text-xs px-3 py-1 text-gray-500 disabled:opacity-50">Cancel</button>
                      <button disabled={isSubmitting} onClick={handleSubmitReview} className="text-xs px-3 py-1 bg-brand-orange text-white rounded disabled:opacity-50">
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {isPublished && (
              <a href={`/property/${property.id}`} target="_blank" className="text-brand-orange text-sm hover:underline">
                View Public Listing
              </a>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-8 relative">
          {error}
          <button onClick={() => setError('')} className="absolute top-4 right-4 text-red-500 hover:text-red-700">✕</button>
        </div>}
        {toast && <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-8">{toast}</div>}

        {isPending && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-8">
            <h3 className="font-medium">Awaiting Admin Approval</h3>
            <p className="text-sm">This property is currently being reviewed by administrators. Editing is disabled until a decision is made.</p>
          </div>
        )}

        {isEditingProp && (
          <form onSubmit={handleUpdateProperty} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 space-y-4">
            <h2 className="text-xl font-medium mb-4">Edit Details</h2>
            <div><label className="block text-sm text-gray-700 mb-1">Name</label><input required type="text" value={editPropForm.name} onChange={e => setEditPropForm({...editPropForm, name: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
            <div><label className="block text-sm text-gray-700 mb-1">Address</label><input required type="text" value={editPropForm.address} onChange={e => setEditPropForm({...editPropForm, address: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm text-gray-700 mb-1">Postcode</label><input required type="text" value={editPropForm.postcode} onChange={e => setEditPropForm({...editPropForm, postcode: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Lat</label><input required type="number" step="any" value={editPropForm.lat} onChange={e => setEditPropForm({...editPropForm, lat: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Lng</label><input required type="number" step="any" value={editPropForm.lng} onChange={e => setEditPropForm({...editPropForm, lng: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
            </div>
            <div><label className="block text-sm text-gray-700 mb-1">Description</label><textarea required rows={4} value={editPropForm.description} onChange={e => setEditPropForm({...editPropForm, description: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
            <div className="flex gap-4 justify-end">
              <button disabled={isSubmitting} type="button" onClick={() => setIsEditingProp(false)} className="px-4 py-2 text-gray-600 hover:text-brand-navy disabled:opacity-50">Cancel</button>
              <button disabled={isSubmitting} type="submit" className="bg-brand-orange text-white px-4 py-2 rounded-md hover:bg-orange-600 disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-8">
          {/* Images Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-medium mb-4">Images</h2>
            <div className="flex flex-wrap gap-4 mb-4">
              {property.media.map((m: any) => (
                <div key={m.id} className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <SafeImage src={m.url} alt="Property" fill className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
            {!isPending && (
              <div>
                <label className="bg-brand-orange/10 text-brand-orange px-4 py-2 rounded-md cursor-pointer hover:bg-indigo-100 transition inline-block">
                  <span>+ Upload Image</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isPending} />
                </label>
                <p className="text-xs text-gray-400 mt-2">Note: S3 storage must be configured to upload real images.</p>
              </div>
            )}
          </section>

          {/* Amenities Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium">Amenities</h2>
              {!isPending && !isEditingAmenities && (
                <button onClick={() => setIsEditingAmenities(true)} className="text-sm text-brand-orange hover:underline">Edit Amenities</button>
              )}
            </div>

            {isEditingAmenities ? (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {allAmenities.map(am => (
                    <label key={am.id} className="flex items-center gap-2 text-sm border p-2 rounded cursor-pointer hover:bg-surface-muted">
                      <input
                        type="checkbox"
                        checked={selectedAmenities.includes(am.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedAmenities([...selectedAmenities, am.id]);
                          else setSelectedAmenities(selectedAmenities.filter(id => id !== am.id));
                        }}
                      />
                      {am.name}
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 justify-end">
                  <button disabled={isSubmitting} onClick={() => {
                    setSelectedAmenities(property.amenities?.map((a: any) => a.amenityId) || []);
                    setIsEditingAmenities(false);
                  }} className="text-sm text-gray-600 disabled:opacity-50">Cancel</button>
                  <button disabled={isSubmitting} onClick={handleUpdateAmenities} className="text-sm bg-brand-orange text-white px-4 py-1.5 rounded hover:bg-orange-600 disabled:opacity-50">
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {property.amenities?.length > 0 ? (
                  property.amenities.map((pa: any) => (
                    <span key={pa.amenityId} className="bg-brand-orange/10 text-brand-orange px-3 py-1 rounded-full text-sm">
                      {pa.amenity.name}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No amenities selected.</p>
                )}
              </div>
            )}
          </section>

          {/* Hierarchy Section */}
          <HierarchyManager property={property} fetchProperty={fetchProperty} isPending={isPending} />

        </div>
      </div>
    </>
  );
}
