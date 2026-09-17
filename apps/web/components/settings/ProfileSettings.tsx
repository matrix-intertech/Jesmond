"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accountStatus: string;
  phone: string;
  countryCode: string;
  ethnicity: string;
  dateOfBirth: string;
  profileCompletion?: { isComplete: boolean; missingFields: string[] };
}

const COUNTRY_CODES = ['+61', '+1', '+44', '+91', '+65', '+64', '+49', '+33', '+86', '+81'];
const ETHNICITIES = ['', 'Asian', 'Black', 'Hispanic', 'White', 'Middle Eastern', 'Pacific Islander', 'Other'];

export default function ProfileSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    accountStatus: "",
    phone: "",
    countryCode: "+61",
    ethnicity: "",
    dateOfBirth: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
        if (status === 'ok') {
          const json = await res.json();
          setData({
            ...json,
            countryCode: json.countryCode || '+61',
            phone: json.phone || '',
            ethnicity: json.ethnicity || '',
            dateOfBirth: json.dateOfBirth ? json.dateOfBirth.split('T')[0] : '',
          });
        } else {
          setError('Failed to load profile');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || undefined,
          countryCode: data.countryCode || undefined,
          ethnicity: data.ethnicity || undefined,
          dateOfBirth: data.dateOfBirth || undefined,
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setData(prev => ({
          ...prev,
          ...updated,
          countryCode: updated.countryCode || prev.countryCode || '+61',
          phone: updated.phone || prev.phone || '',
          ethnicity: updated.ethnicity || prev.ethnicity || '',
          dateOfBirth: updated.dateOfBirth ? updated.dateOfBirth.split('T')[0] : prev.dateOfBirth || '',
        }));
        setSuccess("Profile updated successfully");
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to update profile');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading profile...</div>;

  const missingFields = data.profileCompletion?.missingFields ?? [];

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-brand-navy">Personal Profile</h3>
        <p className="mt-1 text-sm text-gray-500">Manage your basic account information.</p>
      </div>

      {missingFields.length > 0 && (
        <div className="mx-6 mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <span className="text-amber-500 mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-800">Profile incomplete</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Please fill in the highlighted fields below to complete your profile.
              {missingFields.includes('retailStoreName') && (
                <span className="block mt-1">
                  <strong>Note:</strong> Your Retail Store Name is also missing. Please update it in your <a href="/portal/settings/business" className="underline text-brand-orange hover:text-orange-700">Business Profile</a>.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="p-6">
        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <input type="text" value={data.firstName || ''} onChange={e => setData({...data, firstName: e.target.value})} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input type="text" value={data.lastName || ''} onChange={e => setData({...data, lastName: e.target.value})} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address <span className="text-xs text-gray-400 font-normal ml-2">(Contact support to change)</span></label>
              <input type="email" value={data.email || ''} disabled className="mt-1 block w-full rounded-md border border-gray-300 bg-surface-muted text-gray-500 shadow-sm sm:text-sm px-3 py-2 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role &amp; Status</label>
              <div className="mt-1 flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-semantic-info">{data.role}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${data.accountStatus === 'ACTIVE' ? 'bg-emerald-50 text-semantic-success' : 'bg-amber-50 text-semantic-warning'}`}>{data.accountStatus}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Contact &amp; Identity</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                  {missingFields.includes('phone') && <span className="text-amber-600 text-xs ml-1">* Required to complete profile</span>}
                </label>
                <div className="flex gap-2">
                  <select
                    value={data.countryCode}
                    onChange={e => setData({...data, countryCode: e.target.value})}
                    className={`w-24 rounded-md border shadow-sm sm:text-sm px-2 py-2 focus:border-brand-orange focus:ring-brand-orange ${missingFields.includes('countryCode') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
                  >
                    {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="tel"
                    value={data.phone}
                    onChange={e => setData({...data, phone: e.target.value})}
                    placeholder="Phone number"
                    className={`flex-1 rounded-md border shadow-sm sm:text-sm px-3 py-2 focus:border-brand-orange focus:ring-brand-orange ${missingFields.includes('phone') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ethnicity
                  {missingFields.includes('ethnicity') && <span className="text-amber-600 text-xs ml-1">* Required to complete profile</span>}
                </label>
                <select
                  value={data.ethnicity}
                  onChange={e => setData({...data, ethnicity: e.target.value})}
                  className={`mt-1 block w-full rounded-md border shadow-sm sm:text-sm px-3 py-2 focus:border-brand-orange focus:ring-brand-orange ${missingFields.includes('ethnicity') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
                >
                  {ETHNICITIES.map(eth => <option key={eth} value={eth}>{eth || 'Prefer not to say'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                  {missingFields.includes('dateOfBirth') && <span className="text-amber-600 text-xs ml-1">* Required to complete profile</span>}
                </label>
                <input
                  type="date"
                  value={data.dateOfBirth}
                  onChange={e => setData({...data, dateOfBirth: e.target.value})}
                  className={`mt-1 block w-full rounded-md border shadow-sm sm:text-sm px-3 py-2 focus:border-brand-orange focus:ring-brand-orange ${missingFields.includes('dateOfBirth') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

