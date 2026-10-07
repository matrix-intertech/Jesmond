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
 allowPublicContactDetails: boolean;
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
 allowPublicContactDetails: false,
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
 allowPublicContactDetails: data.allowPublicContactDetails,
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

 if (loading) return <div className="p-8 text-center text-text-secondary">Loading profile...</div>;

 const missingFields = data.profileCompletion?.missingFields ?? [];

 return (
 <div className="bg-surface shadow rounded-lg overflow-hidden">
 <div className="px-4 py-5 sm:px-6 border-b border-border-strong">
 <h3 className="text-lg leading-6 font-medium text-primary">Personal Profile</h3>
 <p className="mt-1 text-sm text-text-secondary">Manage your basic account information.</p>
 </div>

 {missingFields.length > 0 && (
 <div className="mx-6 mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
 <span className="text-amber-500 mt-0.5">&#9888;</span>
 <div>
 <p className="text-sm font-medium text-amber-800">Profile incomplete</p>
 <p className="text-sm text-amber-700 mt-0.5">
 Please fill in the highlighted fields below to complete your profile.
 {missingFields.includes('retailStoreName') && (
 <span className="block mt-1">
 <strong>Note:</strong> Your Business Name is also missing. Please update it in your <a href="/portal/settings/business" className="underline text-accent hover:text-orange-700">Business Profile</a>.
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
 <label className="block text-sm font-medium text-text-primary">First Name</label>
 <input type="text" value={data.firstName || ''} onChange={e => setData({...data, firstName: e.target.value})} className="mt-1 block w-full rounded-md border border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm px-3 py-2" required />
 </div>
 <div>
 <label className="block text-sm font-medium text-text-primary">Last Name</label>
 <input type="text" value={data.lastName || ''} onChange={e => setData({...data, lastName: e.target.value})} className="mt-1 block w-full rounded-md border border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm px-3 py-2" required />
 </div>
 <div>
 <label className="block text-sm font-medium text-text-primary">Email Address <span className="text-xs text-text-muted font-normal ml-2">(Contact support to change)</span></label>
 <input type="email" value={data.email || ''} disabled className="mt-1 block w-full rounded-md border border-border-strong bg-surface-muted text-text-secondary shadow-sm sm:text-sm px-3 py-2 cursor-not-allowed" />
 </div>
 <div>
 <label className="block text-sm font-medium text-text-primary">Role &amp; Status</label>
 <div className="mt-1 flex items-center space-x-2">
 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-info-bg text-semantic-info">{data.role}</span>
 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${data.accountStatus === 'ACTIVE' ? 'bg-emerald-50 text-semantic-success' : 'bg-amber-50 text-semantic-warning'}`}>{data.accountStatus}</span>
 </div>
 </div>
 </div>

 <div className="border-t border-border-subtle pt-4">
 <h4 className="text-sm font-semibold text-text-primary mb-4">Contact &amp; Identity</h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-text-primary mb-1">
 Phone Number
 {missingFields.includes('phone') && <span className="text-amber-600 text-xs ml-1">* Required to complete profile</span>}
 </label>
 <div className="flex gap-2">
 <select
 value={data.countryCode}
 onChange={e => setData({...data, countryCode: e.target.value})}
 className={`w-24 rounded-md border shadow-sm sm:text-sm px-2 py-2 focus:border-accent focus:ring-accent ${missingFields.includes('countryCode') ? 'border-amber-400 bg-amber-50' : 'border-border-strong'}`}
 >
 {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
 </select>
 <input
 type="tel"
 value={data.phone}
 onChange={e => setData({...data, phone: e.target.value})}
 placeholder="Phone number"
 className={`flex-1 rounded-md border shadow-sm sm:text-sm px-3 py-2 focus:border-accent focus:ring-accent ${missingFields.includes('phone') ? 'border-amber-400 bg-amber-50' : 'border-border-strong'}`}
 />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-text-primary mb-1">
 Ethnicity
 {missingFields.includes('ethnicity') && <span className="text-amber-600 text-xs ml-1">* Required to complete profile</span>}
 </label>
 <select
 value={data.ethnicity}
 onChange={e => setData({...data, ethnicity: e.target.value})}
 className={`mt-1 block w-full rounded-md border shadow-sm sm:text-sm px-3 py-2 focus:border-accent focus:ring-accent ${missingFields.includes('ethnicity') ? 'border-amber-400 bg-amber-50' : 'border-border-strong'}`}
 >
 {ETHNICITIES.map(eth => <option key={eth} value={eth}>{eth || 'Prefer not to say'}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-text-primary mb-1">
 Date of Birth
 {missingFields.includes('dateOfBirth') && <span className="text-amber-600 text-xs ml-1">* Required to complete profile</span>}
 </label>
 <input
 type="date"
 value={data.dateOfBirth}
 onChange={e => setData({...data, dateOfBirth: e.target.value})}
 className={`mt-1 block w-full rounded-md border shadow-sm sm:text-sm px-3 py-2 focus:border-accent focus:ring-accent ${missingFields.includes('dateOfBirth') ? 'border-amber-400 bg-amber-50' : 'border-border-strong'}`}
 />
 </div>
 </div>
 </div>

 <div className="border-t border-border-subtle pt-6">
 <h3 className="text-base font-semibold text-text-primary mb-2">Public Contact Information</h3>
 <p className="text-sm text-text-secondary mb-4">
 Allow students and visitors to view my contact details on my public Agency profile.
 </p>
 <div className="flex items-center space-x-3">
 <button
 type="button"
 role="switch"
 aria-checked={data.allowPublicContactDetails}
 onClick={() => setData({ ...data, allowPublicContactDetails: !data.allowPublicContactDetails })}
 className={`${data.allowPublicContactDetails ? 'bg-accent' : 'bg-secondary'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2`}
 >
 <span
 aria-hidden="true"
 className={`${data.allowPublicContactDetails ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out`}
 />
 </button>
 <span className="text-sm font-medium text-text-primary">
 {data.allowPublicContactDetails ? 'ON: Your email and phone number may be displayed publicly on your Agency profile.' : 'OFF: Your contact details are private.'}
 </span>
 </div>
 </div>

 <div className="flex justify-end pt-4 border-t border-border-subtle">
 <button
 type="submit"
 disabled={submitting}
 className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-accent hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
 >
 {submitting ? 'Saving...' : 'Save Changes'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}

