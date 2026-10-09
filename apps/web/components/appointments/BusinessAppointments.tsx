'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '@/utils/api';
import { getAccessToken, isAuthenticated } from '@/utils/auth';
import { Calendar, Clock, Loader2, Info, User, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function BusinessAppointments({
  branchId,
  businessName,
  timezone = 'Australia/Sydney',
}: {
  branchId: string;
  businessName: string;
  timezone?: string;
}) {
  const router = useRouter();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<{ startTime: string; endTime: string } | null>(
    null
  );
  const [notes, setNotes] = useState('');
  
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch(`${getApiUrl()}/api/v1/appointments/services?branchId=${branchId}`);
        if (!res.ok) throw new Error('Failed to load services');
        const data = await res.json();
        setServices(data || []);
        if (data && data.length > 0) {
          setSelectedService(data[0].id);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchServices();
  }, [branchId]);

  useEffect(() => {
    if (!selectedService || !selectedDate) {
      setAvailableSlots([]);
      return;
    }

    async function fetchAvailability() {
      setSlotsLoading(true);
      setSlotsError(null);
      setSelectedSlot(null);
      try {
        const res = await fetch(
          `${getApiUrl()}/api/v1/appointments/availability?serviceId=${selectedService}&date=${selectedDate}&timezone=${encodeURIComponent(timezone)}`
        );
        if (!res.ok) throw new Error('Failed to fetch availability');
        const data = await res.json();
        setAvailableSlots(data.availableSlots || []);
      } catch (err: any) {
        setSlotsError(err.message);
      } finally {
        setSlotsLoading(false);
      }
    }
    fetchAvailability();
  }, [selectedService, selectedDate, timezone]);

  const handleBooking = async () => {
    if (!isAuthenticated()) {
      router.push(`/login?redirect=/businesses/store/${branchId}`);
      return;
    }
    if (!selectedService || !selectedSlot || !selectedDate) return;

    setBookingStatus('submitting');
    setBookingError(null);

    const token = getAccessToken();
    const startTimeUtc = new Date(`${selectedDate}T${selectedSlot.startTime}:00Z`).toISOString();
    const endTimeUtc = new Date(`${selectedDate}T${selectedSlot.endTime}:00Z`).toISOString();

    try {
      const res = await fetch(`${getApiUrl()}/api/v1/appointments/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          branchId,
          serviceId: selectedService,
          startTime: startTimeUtc,
          endTime: endTimeUtc,
          timezone,
          customerNotes: notes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to submit appointment request');
      }

      setBookingStatus('success');
    } catch (err: any) {
      setBookingStatus('error');
      setBookingError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-surface rounded-3xl border border-border-strong/60">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 flex flex-col items-center">
        <X size={32} className="mb-2" />
        <h3 className="font-bold text-lg">Error loading services</h3>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="bg-surface-lavender rounded-3xl p-12 text-center border border-border-strong/60">
        <Info size={40} className="mx-auto text-brand-purple mb-4" />
        <h3 className="text-xl font-bold text-primary">No services available</h3>
        <p className="text-text-secondary mt-2">This business has no bookable services configured at this time.</p>
      </div>
    );
  }

  if (bookingStatus === 'success') {
    return (
      <div className="bg-green-50 rounded-3xl p-10 text-center border border-green-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-200 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Calendar size={36} className="text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-green-800 tracking-tight">Request Submitted!</h3>
        <p className="text-green-700 mt-3 max-w-md mx-auto text-lg">
          Your booking request has been sent and is <strong className="font-semibold">pending approval</strong>. The business will review it and assign a professional to your appointment.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/my-appointments" className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md w-full sm:w-auto">
            View My Appointments
          </Link>
          <button 
            onClick={() => {
              setBookingStatus('idle');
              setSelectedSlot(null);
              setNotes('');
            }}
            className="px-6 py-3 bg-white text-green-700 border border-green-200 rounded-xl font-bold hover:bg-green-50 transition-all w-full sm:w-auto"
          >
            Book Another
          </button>
        </div>
      </div>
    );
  }

  const selectedServiceObj = services.find((s) => s.id === selectedService);

  return (
    <div className="bg-surface rounded-3xl p-8 lg:p-10 border border-border-strong/60 shadow-sm relative overflow-hidden">
      <h2 className="text-2xl font-bold text-primary mb-6">Book an Appointment</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Col: Service & Date */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          
          {/* Services List */}
          <div>
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">1. Select Service</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => setSelectedService(svc.id)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${
                    selectedService === svc.id 
                      ? 'border-accent bg-accent/5 ring-2 ring-accent/20' 
                      : 'border-border-strong hover:border-text-secondary bg-surface-muted'
                  }`}
                >
                  <div className="font-bold text-primary text-lg">{svc.name}</div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                    <span className="flex items-center gap-1.5"><Clock size={14}/> {svc.durationMins} mins</span>
                    {svc.price > 0 && <span className="font-semibold text-brand-navy">${svc.price.toFixed(2)}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">2. Select Date</h3>
            <input
              type="date"
              className="w-full sm:w-64 p-4 rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-primary font-medium"
              value={selectedDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Time Slots */}
          <div>
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">3. Select Time</h3>
            {slotsLoading ? (
              <div className="flex items-center gap-3 text-text-secondary py-4">
                <Loader2 className="animate-spin" size={20} /> Checking availability...
              </div>
            ) : slotsError ? (
              <div className="text-red-500 py-4 bg-red-50 px-4 rounded-xl text-sm border border-red-100">{slotsError}</div>
            ) : availableSlots.length === 0 ? (
              <div className="text-text-secondary py-6 bg-surface-muted px-6 rounded-2xl border border-border-strong/50 text-center">
                No available slots for this date.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {availableSlots.map((slot, idx) => {
                  const isSelected = selectedSlot?.startTime === slot.startTime;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-3 px-2 rounded-xl text-sm font-bold transition-all border ${
                        isSelected 
                          ? 'bg-accent text-white border-accent shadow-md shadow-accent/20' 
                          : 'bg-white text-primary border-border-strong hover:border-accent hover:text-accent'
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Summary & Submit */}
        <div className="lg:col-span-5">
          <div className="bg-surface-muted rounded-3xl p-6 lg:p-8 border border-border-strong h-full sticky top-6">
            <h3 className="font-bold text-xl text-primary mb-6">Booking Summary</h3>
            
            <div className="flex flex-col gap-4 mb-8">
              <div className="flex justify-between items-start">
                <div className="text-text-secondary text-sm">Service</div>
                <div className="text-right font-semibold text-primary">{selectedServiceObj?.name || '---'}</div>
              </div>
              <div className="flex justify-between items-start">
                <div className="text-text-secondary text-sm">Duration</div>
                <div className="text-right font-semibold text-primary">{selectedServiceObj ? `${selectedServiceObj.durationMins} mins` : '---'}</div>
              </div>
              <div className="flex justify-between items-start">
                <div className="text-text-secondary text-sm">Date & Time</div>
                <div className="text-right font-semibold text-primary">
                  {selectedDate && selectedSlot ? (
                    <>
                      {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}<br/>
                      <span className="text-accent">{selectedSlot.startTime}</span>
                    </>
                  ) : '---'}
                </div>
              </div>
              {selectedServiceObj?.price > 0 && (
                <div className="flex justify-between items-start pt-4 border-t border-border-strong">
                  <div className="text-text-secondary font-bold">Total</div>
                  <div className="text-right font-extrabold text-lg text-primary">${selectedServiceObj.price.toFixed(2)}</div>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-text-secondary mb-2">Optional Notes</label>
              <textarea
                className="w-full p-4 rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-accent bg-white resize-none text-sm placeholder:text-gray-400"
                placeholder="Any special requests?"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {bookingError && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
                {bookingError}
              </div>
            )}

            <button
              disabled={!selectedSlot || bookingStatus === 'submitting'}
              onClick={handleBooking}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                !selectedSlot || bookingStatus === 'submitting'
                  ? 'bg-gray-300 cursor-not-allowed shadow-none text-gray-500'
                  : 'bg-brand-navy hover:bg-brand-navy/90 shadow-brand-navy/20 hover:shadow-brand-navy/30'
              }`}
            >
              {bookingStatus === 'submitting' ? (
                <><Loader2 className="animate-spin" size={20} /> Processing...</>
              ) : (
                'Request Appointment'
              )}
            </button>
            <p className="text-xs text-center text-text-secondary mt-4">
              Requires confirmation from {businessName}. You won't be charged.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
