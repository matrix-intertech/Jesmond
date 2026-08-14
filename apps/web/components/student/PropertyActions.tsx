"use client";

import { useState } from "react";
import Link from "next/link";
import { getAccessToken, clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import { useRouter } from 'next/navigation';

export function PropertyActions({ propertyId, roomTypes }: { propertyId: string, roomTypes: any[] }) {
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [showApply, setShowApply] = useState<string | null>(null);
  
  const [message, setMessage] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [durationMonths, setDurationMonths] = useState(6);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [applicationResult, setApplicationResult] = useState<any>(null);

  const router = useRouter();
// Auth error handling will use clearAuth directly in fetch calls
const isLoggedIn = () => {
    if (typeof window === 'undefined') return false;
    return !!getAccessToken();
  };

  const handleEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
        const token = getAccessToken();
        if (!token) throw new Error("Please login to send an enquiry");

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/${propertyId}/enquiries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ message })
        });
        const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
        if (status !== 'ok') {
          const isJson = res.headers.get('content-type')?.includes('application/json');
          const err = isJson ? await res.json() : { message: await res.text() };
          throw new Error(err.message || "Failed to send enquiry");
        }
        setSuccess("Enquiry sent successfully!");
        setTimeout(() => setShowEnquiry(false), 2000);
      } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
        const token = getAccessToken();
        if (!token) throw new Error("Please login to apply");

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ propertyId, roomTypeId: showApply, moveInDate, durationMonths })
        });
        const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
        if (status !== 'ok') {
          const isJson = res.headers.get('content-type')?.includes('application/json');
          const err = isJson ? await res.json() : { message: await res.text() };
          throw new Error(err.message || "Failed to submit application");
        }
        const result = await res.json();
        const selectedRoom = roomTypes.find(r => r.id === showApply);
        setApplicationResult({ ...result, roomName: selectedRoom?.name, roomPrice: selectedRoom?.pricePerWeek });
        setSuccess("Application submitted successfully!");
      } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-4 mb-6">
        {isLoggedIn() ? (
          <button onClick={() => setShowEnquiry(true)} className="flex-1 bg-white border-2 border-indigo-600 text-indigo-600 font-bold py-3 px-6 rounded-xl hover:bg-indigo-50 transition">
            Contact Provider
          </button>
        ) : (
          <Link href="/login" className="flex-1 text-center bg-white border-2 border-indigo-600 text-indigo-600 font-bold py-3 px-6 rounded-xl hover:bg-indigo-50 transition">
            Login to Contact
          </Link>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-[24px] p-8 h-fit">
        <h3 className="text-xl font-bold text-slate-900 mb-6">Room Types</h3>
        {roomTypes.length === 0 ? (
          <p className="text-slate-500">No rooms available.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {roomTypes.map(room => (
              <div key={room.id} className="bg-white p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900">{room.name}</h4>
                <p className="text-sm text-slate-500 mb-1">{room.description}</p>
                <p className="text-xs text-slate-400 mb-3">
                  {room.inventory > 0 ? `${room.inventory} available` : 'Currently unavailable'}
                </p>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-indigo-600">${(room.pricePerWeek / 100).toFixed(0)}/wk</span>
                  {isLoggedIn() ? (
                    <button 
                      onClick={() => { setShowApply(room.id); setError(""); setSuccess(""); setApplicationResult(null); }}
                      disabled={room.inventory <= 0}
                      className={`text-sm font-semibold px-4 py-2 rounded-lg transition ${room.inventory > 0 ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                    >
                      {room.inventory > 0 ? 'Reserve Room' : 'Sold Out'}
                    </button>
                  ) : (
                    <Link 
                      href="/register"
                      className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
                    >
                      Sign up to reserve
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEnquiry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative">
            <button onClick={() => setShowEnquiry(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
            <h2 className="text-2xl font-bold mb-4">Send Enquiry</h2>
            {success && <div className="bg-emerald-100 text-emerald-700 p-3 rounded mb-4">{success}</div>}
            {error && <div className="bg-rose-100 text-rose-700 p-3 rounded mb-4">{error}</div>}
            <form onSubmit={handleEnquiry}>
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Message</label>
                <textarea 
                  required 
                  rows={4} 
                  className="w-full border rounded-lg p-3" 
                  value={message} 
                  onChange={e => setMessage(e.target.value)}
                  placeholder="I am interested in this property..."
                />
              </div>
              <button disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition">
                {loading ? 'Sending...' : 'Send Enquiry'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showApply && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative">
            <button onClick={() => { setShowApply(null); setApplicationResult(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
            
            {applicationResult ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2">Application Submitted</h2>
                <p className="text-slate-500 mb-6">Your room reservation request has been sent to the provider for review.</p>
                
                <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
                  <div className="flex justify-between py-2 border-b border-slate-200">
                    <span className="text-sm text-slate-500">Room</span>
                    <span className="text-sm font-semibold">{applicationResult.roomName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200">
                    <span className="text-sm text-slate-500">Weekly Price</span>
                    <span className="text-sm font-semibold">${(applicationResult.lockedPrice / 100).toFixed(2)}/wk</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200">
                    <span className="text-sm text-slate-500">Move-in Date</span>
                    <span className="text-sm font-semibold">{new Date(applicationResult.moveInDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200">
                    <span className="text-sm text-slate-500">Duration</span>
                    <span className="text-sm font-semibold">{applicationResult.durationMonths} months</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-slate-500">Status</span>
                    <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded uppercase tracking-wider">Pending Review</span>
                  </div>
                </div>
                
                <Link 
                  href="/student" 
                  className="inline-block bg-slate-900 text-white font-bold py-3 px-8 rounded-xl hover:bg-slate-800 transition"
                >
                  View My Applications
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-4">Reserve Room</h2>
                <p className="text-slate-500 text-sm mb-4">
                  Room: <span className="font-semibold text-slate-900">{roomTypes.find(r => r.id === showApply)?.name}</span>
                  {' · '}
                  <span className="font-semibold text-indigo-600">${((roomTypes.find(r => r.id === showApply)?.pricePerWeek || 0) / 100).toFixed(0)}/wk</span>
                </p>
                {error && <div className="bg-rose-100 text-rose-700 p-3 rounded mb-4">{error}</div>}
                <form onSubmit={handleApply}>
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Move In Date</label>
                    <input 
                      type="date" 
                      required 
                      className="w-full border rounded-lg p-3" 
                      value={moveInDate} 
                      onChange={e => setMoveInDate(e.target.value)}
                    />
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Duration (Months)</label>
                    <select 
                      required 
                      className="w-full border rounded-lg p-3" 
                      value={durationMonths} 
                      onChange={e => setDurationMonths(Number(e.target.value))}
                    >
                      <option value={3}>3 Months</option>
                      <option value={6}>6 Months</option>
                      <option value={12}>12 Months</option>
                    </select>
                  </div>
                  <button disabled={loading} className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition">
                    {loading ? 'Submitting...' : 'Submit Application'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
