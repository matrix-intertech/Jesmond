"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAccessToken, clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import { useRouter } from 'next/navigation';

export function PropertyActions({ propertyId, roomTypes, showContactDetails, providerContact }: { propertyId: string, roomTypes: any[], showContactDetails?: boolean, providerContact?: any }) {
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [showApply, setShowApply] = useState<string | null>(null);
  
  const [message, setMessage] = useState("");
  const [seekerName, setSeekerName] = useState("");
  const [seekerEmail, setSeekerEmail] = useState("");
  const [seekerPhone, setSeekerPhone] = useState("");
  
  const [moveInDate, setMoveInDate] = useState("");
  const [durationMonths, setDurationMonths] = useState(6);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [applicationResult, setApplicationResult] = useState<any>(null);

  const router = useRouter();
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    setIsAuth(!!getAccessToken());
  }, []);

  const handleSendMessage = async () => {
    if (!isAuth) return router.push('/login');
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/chat/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({ propertyId })
      });
      if (res.ok) {
        const convo = await res.json();
        router.push(`/messages/${convo.id}`);
      } else {
        const err = await res.json();
        setError(err.message || "Failed to start chat");
      }
    } catch(err) {
      setError("Failed to start chat");
    } finally {
      setLoading(false);
    }
  };

  const handleEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
        const token = getAccessToken();
        let url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/public/${propertyId}/enquiries`;
        const headers: any = { 'Content-Type': 'application/json' };
        
        let bodyPayload: any = { message };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          if (!seekerName || !seekerEmail) throw new Error("Name and email are required for guest enquiries");
          bodyPayload = { ...bodyPayload, seekerName, seekerEmail, seekerPhone };
        }

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload)
        });
        const status = await handleApiError(res, () => { if (token) { clearAuth(); router.replace('/login'); } });
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
      <div className="flex flex-col gap-4 mb-6">
        {showContactDetails && providerContact ? (
          <div className="bg-white border-2 border-brand-navy p-6 rounded-xl text-center shadow-sm">
            <h3 className="font-bold text-brand-navy mb-2">Provider Contact</h3>
            {providerContact.name && <p className="font-semibold text-lg text-slate-800">{providerContact.name}</p>}
            {providerContact.phone ? (
              <p className="text-brand-orange font-medium mt-1">{providerContact.phone}</p>
            ) : (
              <p className="text-sm text-slate-500 mt-1">Phone not provided</p>
            )}
            {providerContact.email ? (
              <a href={`mailto:${providerContact.email}`} className="text-sm text-brand-navy hover:underline mt-1 block">{providerContact.email}</a>
            ) : (
              <p className="text-sm text-slate-500 mt-1 block">Email not provided</p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <button onClick={() => setShowEnquiry(true)} className="w-full bg-white border-2 border-brand-orange text-brand-orange font-bold py-3 px-6 rounded-xl hover:bg-brand-orange/10 transition">
                Contact Provider (Email)
              </button>
              {isAuth && (
                <button disabled={loading} onClick={handleSendMessage} className="w-full bg-brand-navy border-2 border-brand-navy text-white font-bold py-3 px-6 rounded-xl hover:bg-brand-navy/90 transition">
                  Message Host
                </button>
              )}
            </div>
            {error && !showEnquiry && !showApply && (
              <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}
          </>
        )}
      </div>

      <div className="h-fit rounded-[20px] border border-slate-200 bg-surface-muted p-4 sm:rounded-[24px] sm:p-8">
        <h3 className="text-xl font-bold text-brand-navy mb-6">Room Types</h3>
        {roomTypes.length === 0 ? (
          <p className="text-slate-500">No rooms available.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {roomTypes.map(room => (
              <div key={room.id} className="bg-white p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-brand-navy">{room.name}</h4>
                <p className="text-sm text-slate-500 mb-1">{room.description}</p>
                <p className="text-xs text-slate-400 mb-3">
                  {room.inventory > 0 ? `${room.inventory} available` : 'Currently unavailable'}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-bold text-brand-orange">${(room.pricePerWeek / 100).toFixed(0)}/wk</span>
                  {isAuth ? (
                    <button 
                      onClick={() => { setShowApply(room.id); setError(""); setSuccess(""); setApplicationResult(null); }}
                      disabled={room.inventory <= 0}
                      className={`text-sm font-semibold px-4 py-2 rounded-lg transition ${room.inventory > 0 ? 'bg-brand-navy text-white hover:bg-brand-navy/90' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                    >
                      {room.inventory > 0 ? 'Reserve Room' : 'Sold Out'}
                    </button>
                  ) : (
                    <Link 
                      href="/register"
                      className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-orange text-white hover:bg-orange-600 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 sm:p-6">
            <button onClick={() => setShowEnquiry(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
            <h2 className="text-2xl font-bold mb-4">Send Enquiry</h2>
            {success && <div className="bg-emerald-100 text-emerald-700 p-3 rounded mb-4">{success}</div>}
            {error && <div className="bg-rose-100 text-rose-700 p-3 rounded mb-4">{error}</div>}
            <form onSubmit={handleEnquiry}>
              {!isAuth && (
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Your Name *</label>
                    <input required type="text" className="w-full border rounded-lg p-3" value={seekerName} onChange={e => setSeekerName(e.target.value)} placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Your Email *</label>
                    <input required type="email" className="w-full border rounded-lg p-3" value={seekerEmail} onChange={e => setSeekerEmail(e.target.value)} placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Your Phone</label>
                    <input type="tel" className="w-full border rounded-lg p-3" value={seekerPhone} onChange={e => setSeekerPhone(e.target.value)} placeholder="+61 400 000 000" />
                  </div>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Message *</label>
                <textarea 
                  required 
                  rows={4} 
                  className="w-full border rounded-lg p-3" 
                  value={message} 
                  onChange={e => setMessage(e.target.value)}
                  placeholder="I am interested in this property..."
                />
              </div>
              <button disabled={loading} className="min-h-11 w-full rounded-lg bg-brand-orange py-3 font-bold text-white transition hover:bg-orange-600">
                {loading ? 'Sending...' : 'Send Enquiry'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 sm:p-6">
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
                
                <div className="bg-surface-muted rounded-xl p-4 text-left mb-6">
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
                  className="inline-block bg-brand-navy text-white font-bold py-3 px-8 rounded-xl hover:bg-brand-navy/90 transition"
                >
                  View My Applications
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-4">Reserve Room</h2>
                <p className="text-slate-500 text-sm mb-4">
                  Room: <span className="font-semibold text-brand-navy">{roomTypes.find(r => r.id === showApply)?.name}</span>
                  {' · '}
                  <span className="font-semibold text-brand-orange">${((roomTypes.find(r => r.id === showApply)?.pricePerWeek || 0) / 100).toFixed(0)}/wk</span>
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
                  <button disabled={loading} className="w-full bg-brand-navy text-white font-bold py-3 rounded-lg hover:bg-brand-navy/90 transition">
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
