'use client';

import { useState } from 'react';
import { getAccessToken } from '@/utils/auth';
import { handleApiError } from '@/utils/api';

export default function ResidentManager({ propertyId, initialResidents, onAuthError, onUpdate }: { propertyId: string, initialResidents: any[], onAuthError: () => void, onUpdate: () => void }) {
  const [residents, setResidents] = useState<any[]>(initialResidents || []);
  const [isEditing, setIsEditing] = useState(false);
  const [currentResident, setCurrentResident] = useState<any>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    age: '',
    ethnicity: '',
    occupation: '',
    shortBio: '',
    photoUrl: '',
    publicVisibility: {
      age: false,
      ethnicity: false,
      occupation: false,
      shortBio: false
    }
  });

  const handleOpenNew = () => {
    setCurrentResident(null);
    setForm({
      name: '', email: '', phone: '', age: '', ethnicity: '', occupation: '', shortBio: '', photoUrl: '',
      publicVisibility: { age: false, ethnicity: false, occupation: false, shortBio: false }
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (res: any) => {
    setCurrentResident(res);
    setForm({
      name: res.name || '',
      email: res.email || '',
      phone: res.phone || '',
      age: res.age || '',
      ethnicity: res.ethnicity || '',
      occupation: res.occupation || '',
      shortBio: res.shortBio || '',
      photoUrl: res.photoUrl || '',
      publicVisibility: res.publicVisibility || { age: false, ethnicity: false, occupation: false, shortBio: false }
    });
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return setError('Name is required');

    const token = getAccessToken();
    setIsSubmitting(true);
    setError('');

    const payload = {
      ...form,
      age: form.age ? parseInt(form.age as any) : undefined
    };

    try {
      const url = currentResident 
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${propertyId}/residents/${currentResident.id}`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${propertyId}/residents`;
      
      const res = await fetch(url, {
        method: currentResident ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (await handleApiError(res, onAuthError) === 'ok') {
        setToast(currentResident ? 'Resident updated successfully' : 'Resident added successfully');
        setTimeout(() => setToast(''), 3000);
        setIsEditing(false);
        onUpdate();
      } else {
        const err = await res.json();
        setError(Array.isArray(err.message) ? err.message.join(', ') : err.message);
      }
    } catch (err) {
      setError('Failed to save resident');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (residentId: string) => {
    if (!confirm('Are you sure you want to remove this resident?')) return;
    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${propertyId}/residents/${residentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (await handleApiError(res, onAuthError) === 'ok') {
        setToast('Resident removed');
        setTimeout(() => setToast(''), 3000);
        onUpdate();
      } else {
        setError('Failed to remove resident');
      }
    } catch (err) {
      setError('Failed to remove resident');
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-medium">Residents</h2>
        <button onClick={handleOpenNew} className="text-sm bg-brand-orange text-white px-3 py-1.5 rounded hover:bg-orange-600 transition">
          + Add Resident
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {toast && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{toast}</div>}

      {initialResidents.length === 0 ? (
        <p className="text-gray-500 text-sm">No residents added yet. Add residents to display them on your co-living listing.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialResidents.map((res: any) => (
            <div key={res.id} className="border border-gray-200 rounded-lg p-4 flex flex-col relative">
              <div className="flex items-center gap-3 mb-3">
                {res.photoUrl ? (
                  <img src={res.photoUrl} alt={res.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                    {res.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-gray-900">{res.name}</h4>
                  <p className="text-xs text-gray-500">{res.occupation || 'No occupation listed'}</p>
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-4 flex-1">
                {res.shortBio ? <p className="line-clamp-2">{res.shortBio}</p> : <p className="italic">No bio provided.</p>}
              </div>
              <div className="flex gap-2 text-xs text-brand-orange justify-end mt-auto pt-2 border-t border-gray-100">
                <button onClick={() => handleOpenEdit(res)} className="hover:underline">Edit</button>
                <button onClick={() => handleDelete(res.id)} className="hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{currentResident ? 'Edit Resident' : 'Add Resident'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email (Private)</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone (Private)</label>
                  <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Age</label>
                  <input type="number" min="1" value={form.age} onChange={e => setForm({...form, age: e.target.value})} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ethnicity / Nationality</label>
                  <input type="text" value={form.ethnicity} onChange={e => setForm({...form, ethnicity: e.target.value})} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Occupation</label>
                  <input type="text" value={form.occupation} onChange={e => setForm({...form, occupation: e.target.value})} className="w-full border rounded px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Short Bio</label>
                <textarea rows={3} value={form.shortBio} onChange={e => setForm({...form, shortBio: e.target.value})} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Photo URL</label>
                <input type="text" value={form.photoUrl} onChange={e => setForm({...form, photoUrl: e.target.value})} placeholder="https://..." className="w-full border rounded px-3 py-2" />
              </div>

              <div className="mt-6 border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Public Profile Visibility</h4>
                <p className="text-xs text-gray-500 mb-4">Select which fields should be visible on the public property listing. (Name is always visible; Email and Phone are always private).</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.publicVisibility.age} onChange={e => setForm({...form, publicVisibility: {...form.publicVisibility, age: e.target.checked}})} /> Show Age
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.publicVisibility.ethnicity} onChange={e => setForm({...form, publicVisibility: {...form.publicVisibility, ethnicity: e.target.checked}})} /> Show Ethnicity/Nationality
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.publicVisibility.occupation} onChange={e => setForm({...form, publicVisibility: {...form.publicVisibility, occupation: e.target.checked}})} /> Show Occupation
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.publicVisibility.shortBio} onChange={e => setForm({...form, publicVisibility: {...form.publicVisibility, shortBio: e.target.checked}})} /> Show Short Bio
                  </label>
                </div>
              </div>

              <div className="flex gap-4 justify-end mt-6">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-brand-orange text-white rounded hover:bg-orange-600 disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : 'Save Resident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
