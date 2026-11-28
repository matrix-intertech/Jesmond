"use client";

import React, { useEffect, useState } from 'react';
import { getAccessToken, buildAuthHeaders } from '@/utils/auth';
import { getApiUrl } from '@/utils/api';
import RolesPermissions from './RolesPermissions';

const TABS = ['General', 'Roles & Permissions'];

export default function AgencySettingsPage() {
  const [activeTab, setActiveTab] = useState('General');
  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    isPubliclyVisible: true,
  });

  useEffect(() => {
    fetchAgency();
  }, []);

  const fetchAgency = async () => {
    try {
      const token = getAccessToken();
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/agency/my`, {
        headers: buildAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAgency(data);
        setFormData({
          name: data.name || '',
          isPubliclyVisible: data.isPubliclyVisible !== undefined ? Boolean(data.isPubliclyVisible) : true,
        });
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
    setMessage(null);
    try {
      const token = getAccessToken();
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/agency/my`, {
        method: 'PUT',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Agency settings updated successfully.' });
      } else {
        const errText = await res.text();
        setMessage({ type: 'error', text: errText || 'Failed to update agency settings.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Network error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-text-secondary">Loading agency settings...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold leading-7 text-text-primary sm:truncate sm:tracking-tight">
          Agency Settings
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your agency details, configuration, and public discovery visibility.
        </p>
      </div>

      <div className="border-b border-border-strong mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                ${activeTab === tab
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:border-border-strong hover:text-text-primary'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'General' && (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          {message && (
            <div className={`p-4 rounded-md text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
              {message.text}
            </div>
          )}

          <div className="overflow-hidden rounded-lg bg-surface shadow border border-border-subtle">
            <div className="border-b border-border-strong px-4 py-5 sm:px-6">
              <h3 className="text-base font-semibold leading-6 text-text-primary">Basic Information</h3>
              <p className="mt-1 text-sm text-text-secondary">Manage agency details and directory presence.</p>
            </div>
            <div className="px-4 py-5 sm:p-6 space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium leading-6 text-text-primary">Agency Name</label>
                <div className="mt-2">
                  <input
                    id="name"
                    required
                    className="block w-full rounded-md border border-border-strong py-2 px-3 text-text-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm bg-surface"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              {/* Public Visibility Universal Toggle */}
              <div className="rounded-lg border border-border-subtle bg-slate-50/50 p-4 dark:bg-slate-900/30">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col pr-4">
                    <label htmlFor="agencyIsPubliclyVisible" className="text-sm font-semibold text-text-primary">
                      Public Directory Visibility
                    </label>
                    <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                      When enabled, your agency profile appears in customer agency listings and public search.
                      When disabled, your agency is excluded from public search while staff members retain dashboard access.
                    </p>
                  </div>
                  <div className="flex items-center h-6">
                    <input
                      id="agencyIsPubliclyVisible"
                      name="agencyIsPubliclyVisible"
                      type="checkbox"
                      checked={formData.isPubliclyVisible}
                      onChange={e => setFormData({ ...formData, isPubliclyVisible: e.target.checked })}
                      className="h-5 w-5 rounded border-border-strong text-accent focus:ring-accent cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 disabled:opacity-50"
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
