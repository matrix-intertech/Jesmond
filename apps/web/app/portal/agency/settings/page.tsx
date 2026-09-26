"use client";

import React, { useEffect, useState } from 'react';
import { getAccessToken } from '@/utils/auth';
import RolesPermissions from './RolesPermissions';

const TABS = ['General', 'Roles & Permissions'];

export default function AgencySettingsPage() {
  const [activeTab, setActiveTab] = useState('General');
  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
  });

  useEffect(() => {
    fetchAgency();
  }, []);

  const fetchAgency = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAgency(data);
        setFormData({ name: data.name });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        alert('Agency settings updated successfully.');
      } else {
        alert(await res.text());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading agency settings...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold leading-7 text-gray-900 sm:truncate sm:tracking-tight">
          Agency Settings
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage your agency details and configuration.
        </p>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                ${activeTab === tab 
                  ? 'border-brand-orange text-brand-orange' 
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'General' && (
        <form onSubmit={handleSubmit} className="max-w-2xl">
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900">Basic Information</h3>
              <p className="mt-1 text-sm text-gray-500">This information is displayed publicly to students.</p>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-900">Agency Name</label>
                  <div className="mt-2">
                    <input
                      id="name"
                      required
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-brand-orange sm:text-sm sm:leading-6"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button 
              type="submit" 
              disabled={saving}
              className="inline-flex items-center rounded-md bg-brand-orange px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'Roles & Permissions' && (
        <RolesPermissions />
      )}
    </div>
  );
}
