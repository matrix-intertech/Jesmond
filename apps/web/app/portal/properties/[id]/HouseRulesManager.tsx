'use client';

import { useState } from 'react';
import { getAccessToken } from '@/utils/auth';
import { handleApiError } from '@/utils/api';

export default function HouseRulesManager({ propertyId, initialHouseRule, onAuthError, onUpdate }: { propertyId: string, initialHouseRule: any, onAuthError: () => void, onUpdate: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    smoking: initialHouseRule?.smoking || '',
    pets: initialHouseRule?.pets || '',
    parties: initialHouseRule?.parties || '',
    guests: initialHouseRule?.guests || '',
    quietHoursStart: initialHouseRule?.quietHoursStart || '',
    quietHoursEnd: initialHouseRule?.quietHoursEnd || '',
    additionalRules: initialHouseRule?.additionalRules || ''
  });

  const handleOpenEdit = () => {
    setForm({
      smoking: initialHouseRule?.smoking || '',
      pets: initialHouseRule?.pets || '',
      parties: initialHouseRule?.parties || '',
      guests: initialHouseRule?.guests || '',
      quietHoursStart: initialHouseRule?.quietHoursStart || '',
      quietHoursEnd: initialHouseRule?.quietHoursEnd || '',
      additionalRules: initialHouseRule?.additionalRules || ''
    });
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${propertyId}/house-rules`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (await handleApiError(res, onAuthError) === 'ok') {
        setToast('House rules updated successfully');
        setTimeout(() => setToast(''), 3000);
        setIsEditing(false);
        onUpdate();
      } else {
        const err = await res.json();
        setError(Array.isArray(err.message) ? err.message.join(', ') : err.message);
      }
    } catch (err) {
      setError('Failed to update house rules');
    } finally {
      setIsSubmitting(false);
    }
  };

  const RuleDisplay = ({ label, value }: { label: string, value: string }) => {
    if (!value) return null;
    return (
      <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-900">{value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
      </div>
    );
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-medium">House Rules</h2>
        {!isEditing && (
          <button onClick={handleOpenEdit} className="text-sm text-brand-orange hover:underline">
            Edit Rules
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {toast && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{toast}</div>}

      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Smoking</label>
              <select value={form.smoking} onChange={e => setForm({...form, smoking: e.target.value})} className="w-full border rounded px-3 py-2">
                <option value="">Select policy...</option>
                <option value="NOT_ALLOWED">Not Allowed</option>
                <option value="OUTSIDE_ONLY">Outside Only</option>
                <option value="ALLOWED">Allowed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pets</label>
              <select value={form.pets} onChange={e => setForm({...form, pets: e.target.value})} className="w-full border rounded px-3 py-2">
                <option value="">Select policy...</option>
                <option value="NOT_ALLOWED">Not Allowed</option>
                <option value="CATS_ONLY">Cats Only</option>
                <option value="DOGS_ONLY">Dogs Only</option>
                <option value="SMALL_PETS">Small Pets Only</option>
                <option value="ALLOWED">Allowed (All)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Parties / Events</label>
              <select value={form.parties} onChange={e => setForm({...form, parties: e.target.value})} className="w-full border rounded px-3 py-2">
                <option value="">Select policy...</option>
                <option value="NOT_ALLOWED">Not Allowed</option>
                <option value="WITH_APPROVAL">With Prior Approval</option>
                <option value="ALLOWED">Allowed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Guests</label>
              <select value={form.guests} onChange={e => setForm({...form, guests: e.target.value})} className="w-full border rounded px-3 py-2">
                <option value="">Select policy...</option>
                <option value="NO_OVERNIGHT">No Overnight Guests</option>
                <option value="WITH_APPROVAL">With Prior Approval</option>
                <option value="SHORT_STAYS">Short Stays Allowed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quiet Hours Start</label>
              <input type="time" value={form.quietHoursStart} onChange={e => setForm({...form, quietHoursStart: e.target.value})} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quiet Hours End</label>
              <input type="time" value={form.quietHoursEnd} onChange={e => setForm({...form, quietHoursEnd: e.target.value})} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Additional Rules</label>
            <textarea rows={4} value={form.additionalRules} onChange={e => setForm({...form, additionalRules: e.target.value})} className="w-full border rounded px-3 py-2" placeholder="List any other specific rules for the property..."></textarea>
          </div>
          <div className="flex gap-4 justify-end mt-4">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-brand-orange text-white rounded hover:bg-orange-600 disabled:opacity-50">
              {isSubmitting ? 'Saving...' : 'Save Rules'}
            </button>
          </div>
        </form>
      ) : (
        <>
          {!initialHouseRule ? (
            <p className="text-gray-500 text-sm">No house rules configured. Click Edit Rules to add them.</p>
          ) : (
            <div className="space-y-1">
              <RuleDisplay label="Smoking" value={initialHouseRule.smoking} />
              <RuleDisplay label="Pets" value={initialHouseRule.pets} />
              <RuleDisplay label="Parties/Events" value={initialHouseRule.parties} />
              <RuleDisplay label="Guests" value={initialHouseRule.guests} />
              <RuleDisplay label="Quiet Hours Start" value={initialHouseRule.quietHoursStart} />
              <RuleDisplay label="Quiet Hours End" value={initialHouseRule.quietHoursEnd} />
              
              {initialHouseRule.additionalRules && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Additional Rules</h4>
                  <p className="text-gray-900 text-sm whitespace-pre-line bg-gray-50 p-3 rounded">{initialHouseRule.additionalRules}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
