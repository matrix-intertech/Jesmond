'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getApiUrl } from '@/utils/api';
import { getAccessToken, isAuthenticated } from '@/utils/auth';
import { formatAudPrice } from '@/utils/pricing';
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  Info,
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  MapPin,
  Phone,
  Store,
  Sparkles,
  Plus,
  Home,
  Briefcase,
  Building,
  Edit2,
  Navigation,
  Car,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export type ServiceLocationType = 'AT_BRANCH' | 'CUSTOMER_LOCATION' | 'FLEXIBLE';

interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  durationMins: number;
  isActive: boolean;
  branchId: string;
  locationType?: ServiceLocationType;
  category?: {
    id: string;
    name: string;
    isActive: boolean;
  };
  branch?: {
    id: string;
    name: string;
    operatingHours?: any;
  };
}

interface CustomerAddressItem {
  id: string;
  userId: string;
  label?: string;
  recipientName?: string | null;
  phone?: string | null;
  streetAddress: string;
  unitNumber?: string | null;
  suburb?: string | null;
  city: string;
  state: string;
  postcode: string;
  country: string;
  instructions?: string | null;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface SlotItem {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason?: string;
}

export default function BusinessAppointments({
  branchId,
  businessName,
  timezone = 'Australia/Sydney',
  initialServices,
  branchInfo,
  isDedicatedPage = false,
}: {
  branchId: string;
  businessName: string;
  timezone?: string;
  initialServices?: ServiceItem[];
  branchInfo?: any;
  isDedicatedPage?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // State from URL
  const stepParam = searchParams?.get('step');
  const serviceIdParam = searchParams?.get('serviceId');

  // Services State
  const [services, setServices] = useState<ServiceItem[]>(
    Array.isArray(initialServices) ? initialServices : [],
  );
  const [loading, setLoading] = useState(
    !Array.isArray(initialServices) || initialServices.length === 0,
  );
  const [error, setError] = useState<string | null>(null);

  // Filter & Selected Service
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(serviceIdParam || null);

  // Active step (1: Services, 2: Date & Time)
  const currentStep = stepParam === '2' && selectedServiceId ? 2 : 1;

  // Operating Hours
  const branchOperatingHours = useMemo(() => {
    if (branchInfo?.operatingHours) return branchInfo.operatingHours;
    if (services.length > 0 && services[0].branch?.operatingHours) {
      return services[0].branch.operatingHours;
    }
    return null;
  }, [branchInfo, services]);

  // Calendar & Date State
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  // Time Slots State
  const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
  const [allSlots, setAllSlots] = useState<SlotItem[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [isBranchOpenToday, setIsBranchOpenToday] = useState(true);

  // Selection & Booking Submission
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [submittedAppointment, setSubmittedAppointment] = useState<any>(null);

  // Address & Service Location State
  const initialAddressForm = {
    label: 'Home',
    recipientName: '',
    phone: '',
    streetAddress: '',
    unitNumber: '',
    suburb: '',
    city: '',
    state: 'NSW',
    postcode: '',
    country: 'Australia',
    instructions: '',
    isDefault: false,
  };

  const [savedAddresses, setSavedAddresses] = useState<CustomerAddressItem[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressFormError, setAddressFormError] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [locationChoice, setLocationChoice] = useState<'AT_BRANCH' | 'CUSTOMER_LOCATION'>('CUSTOMER_LOCATION');
  const [addressForm, setAddressForm] = useState(initialAddressForm);

  // Fetch Services on Mount if not provided
  useEffect(() => {
    if (initialServices && initialServices.length > 0) return;
    async function fetchServices() {
      try {
        const res = await fetch(`${getApiUrl()}/api/v1/appointments/services?branchId=${branchId}`);
        if (!res.ok) throw new Error('Failed to load services');
        const data = await res.json();
        setServices(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchServices();
  }, [branchId, initialServices]);

  // Synchronize URL serviceId param with state
  useEffect(() => {
    if (services.length === 0) return;

    if (serviceIdParam) {
      const exists = services.some((s) => s.id === serviceIdParam);
      if (exists) {
        setSelectedServiceId(serviceIdParam);
      } else {
        // Invalid or non-existent serviceId in URL -> reset gracefully
        setSelectedServiceId(null);
        if (stepParam === '2') {
          router.replace(`${pathname}?step=1`, { scroll: false });
        }
      }
    } else if (services.length > 0 && !selectedServiceId) {
      // Default to first service on initial page load if none selected
      setSelectedServiceId(services[0].id);
    }
  }, [services, serviceIdParam, stepParam, pathname, router, selectedServiceId]);

  // Selected Service Object
  const selectedService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || null;
  }, [services, selectedServiceId]);

  // Synchronize locationChoice with selectedService.locationType
  useEffect(() => {
    if (!selectedService) return;
    if (selectedService.locationType === 'CUSTOMER_LOCATION') {
      setLocationChoice('CUSTOMER_LOCATION');
    } else if (selectedService.locationType === 'AT_BRANCH') {
      setLocationChoice('AT_BRANCH');
    }
  }, [selectedService]);

  // Effective location type based on service configuration and user choice (for FLEXIBLE)
  const effectiveLocationType = useMemo<'AT_BRANCH' | 'CUSTOMER_LOCATION'>(() => {
    if (!selectedService) return 'AT_BRANCH';
    if (selectedService.locationType === 'CUSTOMER_LOCATION') return 'CUSTOMER_LOCATION';
    if (selectedService.locationType === 'AT_BRANCH') return 'AT_BRANCH';
    return locationChoice;
  }, [selectedService, locationChoice]);

  // Resolved selected customer address
  const selectedAddress = useMemo(() => {
    if (!selectedAddressId) return null;
    return savedAddresses.find((a) => a.id === selectedAddressId) || null;
  }, [savedAddresses, selectedAddressId]);

  // Fetch Saved Addresses when on Step 2
  const fetchCustomerAddresses = useCallback(async () => {
    if (!isAuthenticated()) return;
    setAddressesLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/api/v1/customer/addresses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data: CustomerAddressItem[] = await res.json();
        setSavedAddresses(data || []);
        if (data && data.length > 0) {
          setSelectedAddressId((prev) => {
            if (prev && data.some((a) => a.id === prev)) return prev;
            const def = data.find((a) => a.isDefault);
            return def ? def.id : data[0].id;
          });
        }
      }
    } catch (err) {
      console.error('Failed to load customer addresses', err);
    } finally {
      setAddressesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentStep === 2) {
      fetchCustomerAddresses();
    }
  }, [currentStep, fetchCustomerAddresses]);

  // Open Edit Address Form
  const handleOpenEditAddress = (addr: CustomerAddressItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(addr.id);
    setIsAddingNewAddress(false);
    setAddressForm({
      label: addr.label || 'Home',
      recipientName: addr.recipientName || '',
      phone: addr.phone || '',
      streetAddress: addr.streetAddress || '',
      unitNumber: addr.unitNumber || '',
      suburb: addr.suburb || '',
      city: addr.city || '',
      state: addr.state || 'NSW',
      postcode: addr.postcode || '',
      country: addr.country || 'Australia',
      instructions: addr.instructions || '',
      isDefault: addr.isDefault || false,
    });
    setAddressFormError(null);
  };

  const handleOpenNewAddress = () => {
    setEditingAddressId(null);
    setIsAddingNewAddress(true);
    setAddressForm(initialAddressForm);
    setAddressFormError(null);
  };

  const handleCancelAddressForm = () => {
    setIsAddingNewAddress(false);
    setEditingAddressId(null);
    setAddressForm(initialAddressForm);
    setAddressFormError(null);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      const currentUrl = `${pathname}?${searchParams?.toString() || ''}`;
      router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    if (
      !addressForm.streetAddress.trim() ||
      !addressForm.city.trim() ||
      !addressForm.state.trim() ||
      !addressForm.postcode.trim()
    ) {
      setAddressFormError('Please fill in Street Address, City, State, and Postcode.');
      return;
    }

    setSavingAddress(true);
    setAddressFormError(null);

    const token = getAccessToken();
    const payload = {
      label: addressForm.label.trim() || 'Home',
      recipientName: addressForm.recipientName.trim() || undefined,
      phone: addressForm.phone.trim() || undefined,
      streetAddress: addressForm.streetAddress.trim(),
      unitNumber: addressForm.unitNumber.trim() || undefined,
      suburb: addressForm.suburb.trim() || undefined,
      city: addressForm.city.trim(),
      state: addressForm.state.trim().toUpperCase(),
      postcode: addressForm.postcode.trim(),
      country: addressForm.country.trim() || 'Australia',
      instructions: addressForm.instructions.trim() || undefined,
      isDefault: addressForm.isDefault,
    };

    try {
      const url = editingAddressId
        ? `${getApiUrl()}/api/v1/customer/addresses/${editingAddressId}`
        : `${getApiUrl()}/api/v1/customer/addresses`;
      const method = editingAddressId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save address');
      }

      const savedAddr = await res.json();
      await fetchCustomerAddresses();
      setSelectedAddressId(savedAddr.id);
      setIsAddingNewAddress(false);
      setEditingAddressId(null);
      setAddressForm(initialAddressForm);
    } catch (err: any) {
      setAddressFormError(err.message || 'Error saving address');
    } finally {
      setSavingAddress(false);
    }
  };

  // Category List for Filtering
  const categories = useMemo(() => {
    const list: string[] = [];
    services.forEach((s) => {
      if (s.category?.name && !list.includes(s.category.name)) {
        list.push(s.category.name);
      }
    });
    return list;
  }, [services]);

  // Filtered Services List
  const filteredServices = useMemo(() => {
    if (selectedCategoryFilter === 'ALL') return services;
    return services.filter((s) => s.category?.name === selectedCategoryFilter);
  }, [services, selectedCategoryFilter]);

  // Check if a given date is marked closed by branch operating hours
  const isDateClosedByHours = useCallback(
    (dateObj: Date): boolean => {
      if (!branchOperatingHours || !Array.isArray(branchOperatingHours)) return false;
      const dayOfWeek = dateObj.getDay(); // 0 is Sunday
      const config = branchOperatingHours.find((h: any) => h.dayOfWeek === dayOfWeek);
      if (config && config.isOpen === false) {
        return true;
      }
      return false;
    },
    [branchOperatingHours],
  );

  // Fetch Availability when selectedService or selectedDate changes
  useEffect(() => {
    if (!selectedServiceId || !selectedDate || currentStep !== 2) {
      setAvailableSlots([]);
      setAllSlots([]);
      return;
    }

    async function fetchAvailability() {
      setSlotsLoading(true);
      setSlotsError(null);
      setSelectedSlot(null);

      try {
        const res = await fetch(
          `${getApiUrl()}/api/v1/appointments/availability?serviceId=${selectedServiceId}&date=${selectedDate}&timezone=${encodeURIComponent(
            timezone,
          )}`,
        );
        if (!res.ok) throw new Error('Failed to fetch availability');
        const data = await res.json();

        setIsBranchOpenToday(data.isBranchOpen !== false);
        setAvailableSlots(data.availableSlots || []);

        if (data.slots && Array.isArray(data.slots) && data.slots.length > 0) {
          setAllSlots(data.slots);
        } else if (data.availableSlots) {
          setAllSlots(data.availableSlots.map((s: any) => ({ ...s, isAvailable: true })));
        } else {
          setAllSlots([]);
        }
      } catch (err: any) {
        setSlotsError(err.message || 'Error checking availability');
      } finally {
        setSlotsLoading(false);
      }
    }

    fetchAvailability();
  }, [selectedServiceId, selectedDate, timezone, currentStep]);

  // Step Navigation Handlers
  const handleSelectService = (id: string) => {
    setSelectedServiceId(id);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('serviceId', id);
    if (!params.has('step')) params.set('step', '1');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleContinueToStep2 = () => {
    if (!selectedServiceId) return;
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('step', '2');
    params.set('serviceId', selectedServiceId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleBackToStep1 = () => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('step', '1');
    if (selectedServiceId) params.set('serviceId', selectedServiceId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Booking Submission Handler
  const handleBooking = async () => {
    if (!isAuthenticated()) {
      const currentUrl = `${pathname}?${searchParams?.toString() || ''}`;
      router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    if (!selectedServiceId || !selectedSlot || !selectedDate) return;

    if (effectiveLocationType === 'CUSTOMER_LOCATION' && !selectedAddressId) {
      setBookingStatus('error');
      setBookingError('Please select or add a service address to proceed.');
      return;
    }

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
          serviceId: selectedServiceId,
          startTime: startTimeUtc,
          endTime: endTimeUtc,
          timezone,
          customerNotes: customerNotes.trim() || undefined,
          locationType: effectiveLocationType,
          customerAddressId: effectiveLocationType === 'CUSTOMER_LOCATION' ? selectedAddressId : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to submit appointment request');
      }

      const created = await res.json();
      setSubmittedAppointment(created);
      setBookingStatus('success');
    } catch (err: any) {
      setBookingStatus('error');
      setBookingError(err.message || 'An error occurred while booking. Please try another slot.');
    }
  };

  // Calendar Helpers
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dateString: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isPast: boolean;
      isClosed: boolean;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    // Leading blanks for proper weekday alignment
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dateString: '',
        dayNum: 0,
        isCurrentMonth: false,
        isPast: true,
        isClosed: false,
        isSelected: false,
        isToday: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dObj = new Date(year, month, d);
      const yStr = dObj.getFullYear();
      const mStr = String(dObj.getMonth() + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateString = `${yStr}-${mStr}-${dStr}`;

      const isPast = dObj < today;
      const isClosed = isDateClosedByHours(dObj);
      const isSelected = dateString === selectedDate;
      const isToday = dateString === todayStr;

      days.push({
        dateString,
        dayNum: d,
        isCurrentMonth: true,
        isPast,
        isClosed,
        isSelected,
        isToday,
      });
    }

    return days;
  }, [calendarMonth, today, selectedDate, todayStr, isDateClosedByHours]);

  const canNavigatePrevMonth = useMemo(() => {
    const prev = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    const curStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return prev >= curStart;
  }, [calendarMonth, today]);

  const handlePrevMonth = () => {
    if (!canNavigatePrevMonth) return;
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const handleSelectDate = (dateString: string) => {
    setSelectedDate(dateString);
    setSelectedSlot(null);
  };

  // Render Loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-3xl border border-border-strong/60 shadow-sm min-h-[360px]">
        <Loader2 className="animate-spin text-accent mb-4" size={36} />
        <p className="text-text-secondary font-medium">Loading bookable services...</p>
      </div>
    );
  }

  // Render Error
  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-200 flex flex-col items-center text-center shadow-sm">
        <AlertCircle size={40} className="mb-3 text-red-600" />
        <h3 className="font-bold text-xl">Unable to Load Services</h3>
        <p className="text-sm mt-1 max-w-md text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-md shadow-red-600/20"
        >
          Retry
        </button>
      </div>
    );
  }

  // Render Empty Services State
  if (services.length === 0) {
    return (
      <div className="bg-surface-lavender rounded-3xl p-12 text-center border border-border-strong/60 shadow-sm">
        <Info size={44} className="mx-auto text-brand-purple mb-4" />
        <h3 className="text-2xl font-bold text-primary tracking-tight">No Services Available</h3>
        <p className="text-text-secondary mt-2 max-w-md mx-auto">
          {businessName} has no bookable appointment services configured at this time. Please check back later.
        </p>
        <div className="mt-6">
          <Link
            href={`/businesses/store/${branchId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary border border-border-strong font-bold rounded-xl hover:bg-surface-muted transition-all"
          >
            <ArrowLeft size={16} /> Back to Storefront
          </Link>
        </div>
      </div>
    );
  }

  // Render Success Screen
  if (bookingStatus === 'success') {
    const formattedDate = selectedDate
      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

    return (
      <div className="bg-surface rounded-3xl p-8 lg:p-12 border border-border-strong/60 shadow-sm relative overflow-hidden text-center max-w-2xl mx-auto">
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-40 pointer-events-none" />
        <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-emerald-600/10">
          <Check size={40} className="text-emerald-600" strokeWidth={2.5} />
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 mb-3">
          <Clock size={13} /> Pending Confirmation
        </span>
        <h2 className="text-3xl font-extrabold text-primary tracking-tight">Appointment Request Submitted!</h2>
        <p className="text-text-secondary mt-3 max-w-md mx-auto text-base">
          Your request has been delivered to <strong className="text-primary font-semibold">{businessName}</strong>. A staff member will confirm your time slot shortly.
        </p>

        {/* Booking Details Card */}
        <div className="mt-8 p-6 bg-surface-lavender/60 border border-border-subtle rounded-2xl text-left max-w-lg mx-auto space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary font-medium">Service</span>
            <span className="font-bold text-primary">{selectedService?.name}</span>
          </div>
          <div className="flex justify-between items-start text-sm">
            <span className="text-text-secondary font-medium shrink-0 mr-4">Location</span>
            <span className="font-bold text-primary text-right">
              {effectiveLocationType === 'CUSTOMER_LOCATION'
                ? selectedAddress
                  ? `${selectedAddress.label ? selectedAddress.label + ': ' : ''}${selectedAddress.streetAddress}, ${
                      selectedAddress.suburb ? selectedAddress.suburb + ', ' : ''
                    }${selectedAddress.city} ${selectedAddress.state} ${selectedAddress.postcode}`
                  : 'Customer Location'
                : `Workshop (${branchInfo?.address || 'At Branch'})`}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary font-medium">Date</span>
            <span className="font-bold text-primary">{formattedDate}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary font-medium">Time</span>
            <span className="font-bold text-accent">{selectedSlot?.startTime} – {selectedSlot?.endTime}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary font-medium">Duration</span>
            <span className="font-semibold text-primary">{selectedService?.durationMins} minutes</span>
          </div>
          {selectedService && selectedService.price > 0 && (
            <div className="flex justify-between items-center text-sm pt-2 border-t border-border-strong/60">
              <span className="text-text-secondary font-bold">Estimated Cost</span>
              <span className="font-extrabold text-brand-navy">{formatAudPrice(selectedService.price)} AUD</span>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/my-appointments"
            className="w-full sm:w-auto px-8 py-3.5 bg-accent text-white font-bold rounded-xl hover:bg-accent/90 transition-all shadow-md shadow-accent/20"
          >
            View My Appointments
          </Link>
          <button
            onClick={() => {
              setBookingStatus('idle');
              setSelectedSlot(null);
              setCustomerNotes('');
              router.push(`${pathname}?step=1`, { scroll: false });
            }}
            className="w-full sm:w-auto px-6 py-3.5 bg-white text-text-secondary border border-border-strong font-bold rounded-xl hover:bg-surface-muted transition-all"
          >
            Book Another Service
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Compact Header for Dedicated Page */}
      {isDedicatedPage && (
        <div className="mb-8">
          <Link
            href={`/businesses/store/${branchId}`}
            className="inline-flex items-center gap-2 text-text-secondary hover:text-accent transition-colors font-medium text-sm mb-6"
          >
            <ArrowLeft size={16} /> Back to Storefront
          </Link>

          <div className="bg-surface rounded-3xl p-6 lg:p-8 border border-border-strong/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-brand-navy rounded-2xl flex items-center justify-center text-white shadow-md shadow-brand-navy/15 shrink-0">
                <Store size={28} strokeWidth={1.75} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl lg:text-3xl font-extrabold text-primary tracking-tight">
                    {businessName}
                  </h1>
                  {branchInfo?.organization?.profileCompletion?.overallStatus === 'VERIFIED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                      <ShieldCheck size={13} className="text-emerald-600" />
                      <span>Verified Partner</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-text-secondary flex-wrap">
                  {branchInfo?.address && (
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-accent" /> {branchInfo.address}
                    </span>
                  )}
                  {branchInfo?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={13} className="text-accent" /> {branchInfo.phone}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-surface-lavender text-brand-purple font-semibold">
                    Appointment Booking
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-text-muted bg-surface-muted px-4 py-2 rounded-xl border border-border-subtle self-start md:self-auto">
              Real-time Availability Guaranteed
            </div>
          </div>
        </div>
      )}

      {/* Modern Two-Step Progress Indicator */}
      <div className="mb-10 bg-surface rounded-2xl p-4 lg:p-5 border border-border-strong/60 shadow-sm">
        <div className="flex items-center justify-between max-w-xl mx-auto relative">
          {/* Connecting Bar */}
          <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-1 bg-surface-lavender -z-0">
            <div
              className={`h-full bg-accent transition-all duration-300 ${
                currentStep === 2 ? 'w-full' : 'w-0'
              }`}
            />
          </div>

          {/* Step 1 Node */}
          <button
            type="button"
            onClick={() => currentStep === 2 && handleBackToStep1()}
            className={`relative z-10 flex items-center gap-3 bg-surface pr-4 text-left transition-all ${
              currentStep === 2 ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2 ${
                currentStep === 1
                  ? 'bg-accent text-white border-accent shadow-md shadow-accent/20 ring-4 ring-accent/15'
                  : 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              }`}
            >
              {currentStep > 1 ? <Check size={18} strokeWidth={2.5} /> : '1'}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Step 1
              </div>
              <div
                className={`text-sm font-bold ${
                  currentStep === 1 ? 'text-primary' : 'text-emerald-700'
                }`}
              >
                Select Services
              </div>
            </div>
          </button>

          {/* Step 2 Node */}
          <div className="relative z-10 flex items-center gap-3 bg-surface pl-4 text-left">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2 ${
                currentStep === 2
                  ? 'bg-accent text-white border-accent shadow-md shadow-accent/20 ring-4 ring-accent/15'
                  : 'bg-surface-muted text-text-muted border-border-strong'
              }`}
            >
              2
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Step 2
              </div>
              <div
                className={`text-sm font-bold ${
                  currentStep === 2 ? 'text-primary' : 'text-text-muted'
                }`}
              >
                Select Date & Time
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 1: SELECT SERVICES                                                   */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="space-y-8 animate-fadeIn">
          {/* Header & Category Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border-subtle">
            <div>
              <h2 className="text-2xl font-extrabold text-primary tracking-tight">
                Select Your Service
              </h2>
              <p className="text-sm text-text-secondary mt-0.5">
                Browse available professional offerings and choose the service you wish to book.
              </p>
            </div>

            {/* Category Pills */}
            {categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-text-muted mr-1">Categories:</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selectedCategoryFilter === 'ALL'
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-surface-lavender text-text-secondary hover:text-primary hover:bg-surface-lavender/80 border border-border-subtle'
                  }`}
                >
                  All ({services.length})
                </button>
                {categories.map((catName) => {
                  const count = services.filter((s) => s.category?.name === catName).length;
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(catName)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        selectedCategoryFilter === catName
                          ? 'bg-accent text-white shadow-sm'
                          : 'bg-surface-lavender text-text-secondary hover:text-primary hover:bg-surface-lavender/80 border border-border-subtle'
                      }`}
                    >
                      {catName} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Premium Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((svc) => {
              const isSelected = selectedServiceId === svc.id;
              return (
                <div
                  key={svc.id}
                  onClick={() => handleSelectService(svc.id)}
                  className={`group relative rounded-3xl p-6 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-accent/[0.03] border-accent ring-2 ring-accent/20 shadow-md shadow-accent/10'
                      : 'bg-surface border-border-strong/70 hover:border-accent/40 hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Top Row: Category Tag & Selection Indicator */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-navy/10 text-brand-navy">
                        {svc.category?.name || 'General Service'}
                      </span>
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-accent text-white shadow-sm'
                            : 'border-2 border-border-strong group-hover:border-accent'
                        }`}
                      >
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                    </div>

                    {/* Service Name */}
                    <h3 className="text-xl font-bold text-primary group-hover:text-accent transition-colors leading-snug">
                      {svc.name}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                      {svc.description || 'Professional service handled by verified staff.'}
                    </p>
                  </div>

                  {/* Bottom Row: Duration & Price */}
                  <div className="pt-5 mt-5 border-t border-border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <Clock size={15} className="text-text-muted" />
                      <span>{svc.durationMins} mins</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-brand-navy">
                        {svc.price > 0 ? `${formatAudPrice(svc.price)}` : 'Free'}
                      </span>
                      {svc.price > 0 && <span className="text-[10px] text-text-muted ml-1">AUD</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky / Prominent Bottom Selection Summary Bar */}
          <div className="sticky bottom-6 z-20 bg-surface rounded-3xl p-5 border-2 border-border-strong shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-left w-full sm:w-auto">
              {selectedService ? (
                <div>
                  <div className="text-xs text-text-muted font-bold uppercase tracking-wider">
                    Selected Service
                  </div>
                  <div className="text-base font-extrabold text-primary flex items-center gap-2">
                    <span>{selectedService.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-lavender text-brand-purple">
                      {selectedService.durationMins} mins
                    </span>
                    {selectedService.price > 0 && (
                      <span className="text-xs font-bold text-brand-navy">
                        {formatAudPrice(selectedService.price)} AUD
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-text-secondary font-medium">
                  Please select a service from above to proceed.
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!selectedServiceId}
              onClick={handleContinueToStep2}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all text-sm ${
                selectedServiceId
                  ? 'bg-accent text-white hover:bg-accent/90 shadow-md shadow-accent/20 cursor-pointer'
                  : 'bg-surface-muted text-text-muted cursor-not-allowed border border-border-strong'
              }`}
            >
              <span>Continue to Select Date & Time</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 2: SELECT DATE & TIME + CHECKOUT                                     */}
      {/* ========================================================================= */}
      {currentStep === 2 && selectedService && (
        <div className="space-y-8 animate-fadeIn">
          {/* Top Back Action & Service Summary Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
            <button
              type="button"
              onClick={handleBackToStep1}
              className="inline-flex items-center gap-2 text-text-secondary hover:text-accent font-semibold text-sm transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} /> Change Selected Service
            </button>

            <div className="inline-flex items-center gap-2.5 bg-surface-lavender/60 border border-border-strong/50 px-3.5 py-1.5 rounded-2xl text-xs">
              <span className="text-text-muted font-medium">Booking:</span>
              <strong className="text-primary">{selectedService.name}</strong>
              <span className="text-brand-purple font-semibold">({selectedService.durationMins} mins)</span>
              {selectedService.price > 0 && (
                <span className="text-brand-navy font-bold">{formatAudPrice(selectedService.price)} AUD</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Interactive Date Calendar & Time Slots Grid (7 Cols) */}
            <div className="lg:col-span-7 space-y-8">
              {/* 1. Service Location & Customer Address Selection */}
              <div className="bg-surface rounded-3xl p-6 lg:p-7 border border-border-strong/60 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-bold text-primary flex items-center gap-2">
                    <MapPin size={18} className="text-accent" />
                    <span>Where do you need the service?</span>
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {selectedService.locationType === 'FLEXIBLE'
                      ? 'This service can be provided at our workshop or directly at your location.'
                      : selectedService.locationType === 'CUSTOMER_LOCATION'
                      ? 'This mobile service is provided on-site at your home or workplace.'
                      : 'This service is performed on-site at our workshop location.'}
                  </p>
                </div>

                {/* Location Choice Selection for FLEXIBLE Services */}
                {selectedService.locationType === 'FLEXIBLE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLocationChoice('AT_BRANCH')}
                      className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                        locationChoice === 'AT_BRANCH'
                          ? 'border-accent bg-accent/[0.04] ring-2 ring-accent/20'
                          : 'border-border-strong bg-white hover:border-accent/40'
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-xl ${
                          locationChoice === 'AT_BRANCH'
                            ? 'bg-accent text-white'
                            : 'bg-surface-lavender text-text-secondary'
                        }`}
                      >
                        <Store size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-primary flex items-center justify-between">
                          <span>At Workshop / Branch</span>
                          {locationChoice === 'AT_BRANCH' && <Check size={16} className="text-accent" />}
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                          Bring your vehicle to {branchInfo?.address || 'our workshop'}.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLocationChoice('CUSTOMER_LOCATION')}
                      className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                        locationChoice === 'CUSTOMER_LOCATION'
                          ? 'border-accent bg-accent/[0.04] ring-2 ring-accent/20'
                          : 'border-border-strong bg-white hover:border-accent/40'
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-xl ${
                          locationChoice === 'CUSTOMER_LOCATION'
                            ? 'bg-accent text-white'
                            : 'bg-surface-lavender text-text-secondary'
                        }`}
                      >
                        <Home size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-primary flex items-center justify-between">
                          <span>At My Location / Home Visit</span>
                          {locationChoice === 'CUSTOMER_LOCATION' && <Check size={16} className="text-accent" />}
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                          A verified professional will travel to your address.
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Fixed AT_BRANCH Info Display */}
                {selectedService.locationType === 'AT_BRANCH' && (
                  <div className="p-4 rounded-2xl bg-surface-lavender/40 border border-border-strong/70 flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-brand-navy/10 text-brand-navy shrink-0">
                      <Store size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-primary">In-Store / Workshop Service</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          At Business Location
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        Service takes place at {businessName} ({branchInfo?.address || 'our branch address'}). Customer address is not required.
                      </p>
                    </div>
                  </div>
                )}

                {/* Fixed CUSTOMER_LOCATION Info Display */}
                {selectedService.locationType === 'CUSTOMER_LOCATION' && (
                  <div className="p-4 rounded-2xl bg-surface-lavender/40 border border-border-strong/70 flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-accent/10 text-accent shrink-0">
                      <Car size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-primary">Mobile / On-Site Service</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                          Customer Address Required
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        Our specialist technician will travel to your selected address below with all necessary tools.
                      </p>
                    </div>
                  </div>
                )}

                {/* Address Selection Section (Only required when effectiveLocationType === 'CUSTOMER_LOCATION') */}
                {effectiveLocationType === 'CUSTOMER_LOCATION' && (
                  <div className="pt-4 border-t border-border-subtle space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-primary">Service Address</h4>
                        <p className="text-xs text-text-secondary">Where should the professional attend?</p>
                      </div>
                      {!isAddingNewAddress && !editingAddressId && (
                        <button
                          type="button"
                          onClick={handleOpenNewAddress}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 text-accent hover:bg-accent hover:text-white font-bold text-xs transition-all cursor-pointer"
                        >
                          <Plus size={14} /> Add New Address
                        </button>
                      )}
                    </div>

                    {!isAuthenticated() ? (
                      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-bold">Sign in required for customer address selection</div>
                          <p className="mt-0.5">Please sign in to select from your saved addresses or add a new one.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentUrl = `${pathname}?${searchParams?.toString() || ''}`;
                            router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
                          }}
                          className="px-4 py-2 bg-amber-800 text-white rounded-xl font-bold text-xs shrink-0 hover:bg-amber-900 cursor-pointer"
                        >
                          Sign In Now
                        </button>
                      </div>
                    ) : addressesLoading ? (
                      <div className="py-6 flex items-center justify-center gap-2 text-text-secondary text-xs">
                        <Loader2 size={16} className="animate-spin text-accent" />
                        <span>Loading your saved addresses...</span>
                      </div>
                    ) : isAddingNewAddress || editingAddressId ? (
                      <form onSubmit={handleSaveAddress} className="p-5 rounded-2xl bg-surface-lavender/30 border border-border-strong space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                          <h5 className="font-bold text-sm text-primary flex items-center gap-2">
                            <MapPin size={16} className="text-accent" />
                            <span>{editingAddressId ? 'Edit Address' : 'Add New Address'}</span>
                          </h5>
                          <button
                            type="button"
                            onClick={handleCancelAddressForm}
                            className="text-text-muted hover:text-primary p-1 cursor-pointer"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {addressFormError && (
                          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                            {addressFormError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-text-secondary mb-1">Label</label>
                            <select
                              value={addressForm.label}
                              onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                              className="w-full p-2.5 rounded-xl border border-border-strong text-xs text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="Home">Home</option>
                              <option value="Work">Work</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-text-secondary mb-1">Recipient / Contact Name</label>
                            <input
                              type="text"
                              value={addressForm.recipientName}
                              onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                              placeholder="e.g. John Smith"
                              className="w-full p-2.5 rounded-xl border border-border-strong text-xs text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-text-secondary mb-1">Contact Phone</label>
                            <input
                              type="tel"
                              value={addressForm.phone}
                              onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                              placeholder="e.g. 0412 345 678"
                              className="w-full p-2.5 rounded-xl border border-border-strong text-xs text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-text-secondary mb-1">Unit / Apt / Suite (Optional)</label>
                            <input
                              type="text"
                              value={addressForm.unitNumber}
                              onChange={(e) => setAddressForm({ ...addressForm, unitNumber: e.target.value })}
                              placeholder="e.g. Apt 4B"
                              className="w-full p-2.5 rounded-xl border border-border-strong text-xs text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-text-secondary mb-1">Street Address *</label>
                            <input
                              type="text"
                              required
                              value={addressForm.streetAddress}
                              onChange={(e) => setAddressForm({ ...addressForm, streetAddress: e.target.value })}
                              placeholder="e.g. 42 Main Road"
                              className="w-full p-2.5 rounded-xl border border-border-strong text-xs text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-text-secondary mb-1">Suburb</label>
                            <input
                              type="text"
                              value={addressForm.suburb}
                              onChange={(e) => setAddressForm({ ...addressForm, suburb: e.target.value })}
                              placeholder="e.g. Jesmond"
                              className="w-full p-2.5 rounded-xl border border-border-strong text-xs text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-text-secondary mb-1">City *</label>
                            <input
                              type="text"
                              required
                              value={addressForm.city}
                              onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                              placeholder="e.g. Newcastle"
                              className="w-full p-2.5 rounded-xl border border-border-strong text-xs text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-text-secondary mb-1">State *</label>
                            <select
                              value={addressForm.state}
                              onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                              className="w-full p-2.5 rounded-xl border border-border-strong text-xs text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="NSW">NSW</option>
                              <option value="VIC">VIC</option>
                              <option value="QLD">QLD</option>
                              <option value="WA">WA</option>
                              <option value="SA">SA</option>
                              <option value="TAS">TAS</option>
                              <option value="ACT">ACT</option>
                              <option value="NT">NT</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-text-secondary mb-1">Postcode *</label>
                            <input
                              type="text"
                              required
                              value={addressForm.postcode}
                              onChange={(e) => setAddressForm({ ...addressForm, postcode: e.target.value })}
                              placeholder="e.g. 2299"
                              className="w-full p-2.5 rounded-xl border border-border-strong text-xs text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-text-secondary mb-1">Special Delivery / Access Instructions (Optional)</label>
                            <textarea
                              rows={2}
                              value={addressForm.instructions}
                              onChange={(e) => setAddressForm({ ...addressForm, instructions: e.target.value })}
                              placeholder="e.g. Ring front doorbell or leave around back gate..."
                              className="w-full p-2.5 rounded-xl border border-border-strong text-xs text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            />
                          </div>

                          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id="isDefaultAddr"
                              checked={addressForm.isDefault}
                              onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                              className="w-4 h-4 rounded text-accent border-border-strong focus:ring-accent"
                            />
                            <label htmlFor="isDefaultAddr" className="text-xs text-text-secondary font-medium cursor-pointer">
                              Save as default service address
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                          <button
                            type="button"
                            onClick={handleCancelAddressForm}
                            className="px-4 py-2 rounded-xl border border-border-strong text-xs font-bold text-text-secondary hover:bg-surface-muted transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingAddress}
                            className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            {savingAddress ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <span>{editingAddressId ? 'Update Address' : 'Save & Select Address'}</span>
                            )}
                          </button>
                        </div>
                      </form>
                    ) : savedAddresses.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-surface-muted border border-border-strong text-center space-y-3">
                        <MapPin size={28} className="mx-auto text-text-muted" />
                        <div className="text-sm font-bold text-primary">No Saved Addresses</div>
                        <p className="text-xs text-text-secondary max-w-xs mx-auto">
                          You haven't saved any addresses yet. Add your address to proceed with booking.
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenNewAddress}
                          className="px-4 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent/90 cursor-pointer"
                        >
                          + Add New Address
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {savedAddresses.map((addr) => {
                          const isSelected = selectedAddressId === addr.id;
                          return (
                            <div
                              key={addr.id}
                              onClick={() => setSelectedAddressId(addr.id)}
                              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                                isSelected
                                  ? 'border-accent bg-accent/[0.04] ring-2 ring-accent/20 shadow-sm'
                                  : 'border-border-strong bg-white hover:border-accent/40'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-lavender text-brand-purple inline-flex items-center gap-1">
                                      {addr.label === 'Work' ? (
                                        <Briefcase size={11} />
                                      ) : addr.label === 'Other' ? (
                                        <Building size={11} />
                                      ) : (
                                        <Home size={11} />
                                      )}
                                      <span>{addr.label || 'Home'}</span>
                                    </span>
                                    {addr.isDefault && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenEditAddress(addr, e)}
                                      className="p-1 rounded-lg text-text-muted hover:text-accent hover:bg-surface-lavender transition-colors cursor-pointer"
                                      title="Edit address"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <div
                                      className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${
                                        isSelected ? 'border-accent bg-accent text-white' : 'border-border-strong'
                                      }`}
                                    >
                                      {isSelected && <Check size={12} strokeWidth={3} />}
                                    </div>
                                  </div>
                                </div>

                                {addr.recipientName && (
                                  <div className="text-xs font-bold text-primary">{addr.recipientName}</div>
                                )}
                                {addr.phone && (
                                  <div className="text-[11px] text-text-muted flex items-center gap-1 mb-1">
                                    <Phone size={10} /> {addr.phone}
                                  </div>
                                )}

                                <div className="text-xs text-text-secondary leading-snug">
                                  {addr.unitNumber ? `Unit ${addr.unitNumber}, ` : ''}
                                  {addr.streetAddress}
                                </div>
                                <div className="text-xs text-text-secondary font-medium">
                                  {addr.suburb ? `${addr.suburb}, ` : ''}
                                  {addr.city} {addr.state} {addr.postcode}
                                </div>

                                {addr.instructions && (
                                  <div className="text-[10px] text-text-muted mt-2 italic bg-surface-muted/60 p-1.5 rounded-lg border border-border-subtle">
                                    "{addr.instructions}"
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Date Picker Calendar */}
              <div className="bg-surface rounded-3xl p-6 lg:p-7 border border-border-strong/60 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-primary flex items-center gap-2">
                      <CalendarIcon size={18} className="text-accent" />
                      <span>Select Appointment Date</span>
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Choose an available business operating day.
                    </p>
                  </div>

                  {/* Month Navigation */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canNavigatePrevMonth}
                      onClick={handlePrevMonth}
                      className={`p-2 rounded-xl border border-border-strong transition-all ${
                        canNavigatePrevMonth
                          ? 'hover:bg-surface-muted text-primary cursor-pointer'
                          : 'opacity-40 text-text-muted cursor-not-allowed'
                      }`}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-primary min-w-[110px] text-center">
                      {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-2 rounded-xl border border-border-strong hover:bg-surface-muted text-primary cursor-pointer transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Weekdays Row */}
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {daysOfWeek.map((dow) => (
                    <div key={dow} className="text-[11px] font-bold text-text-muted uppercase py-1">
                      {dow}
                    </div>
                  ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((cd, idx) => {
                    if (!cd.isCurrentMonth) {
                      return <div key={`empty-${idx}`} className="h-10" />;
                    }

                    const isDisabled = cd.isPast || cd.isClosed;

                    return (
                      <button
                        key={cd.dateString}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectDate(cd.dateString)}
                        title={
                          cd.isClosed
                            ? 'Business is closed on this day'
                            : cd.isPast
                            ? 'Past date'
                            : `Select ${cd.dateString}`
                        }
                        className={`h-11 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all relative ${
                          cd.isSelected
                            ? 'bg-accent text-white shadow-md shadow-accent/20 ring-2 ring-accent/30 scale-[1.02]'
                            : isDisabled
                            ? 'bg-surface-muted/30 text-text-muted/40 cursor-not-allowed line-through'
                            : 'bg-surface-lavender/40 text-primary hover:border-accent hover:bg-surface-lavender border border-transparent cursor-pointer'
                        }`}
                      >
                        <span>{cd.dayNum}</span>
                        {cd.isClosed && !cd.isPast && (
                          <span className="text-[8px] font-semibold text-rose-500 line-through">Closed</span>
                        )}
                        {cd.isToday && !cd.isSelected && (
                          <div className="w-1 h-1 rounded-full bg-accent mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Calendar Footer / Operating Status */}
                <div className="mt-4 pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between text-xs text-text-secondary gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-accent" /> Selected
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-surface-lavender border border-border-strong" /> Available
                    </span>
                    <span className="flex items-center gap-1.5 text-text-muted">
                      <div className="w-2.5 h-2.5 rounded-full bg-surface-muted/80 line-through" /> Closed
                    </span>
                  </div>
                  <span className="font-medium text-text-muted">
                    Timezone: {timezone}
                  </span>
                </div>
              </div>

              {/* 2. Available Time Slots Grid */}
              <div className="bg-surface rounded-3xl p-6 lg:p-7 border border-border-strong/60 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-primary flex items-center gap-2">
                      <Clock size={18} className="text-accent" />
                      <span>Select Appointment Time</span>
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Showing real-time slots verified against qualified employee schedules.
                    </p>
                  </div>

                  {selectedDate && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-muted text-text-secondary border border-border-subtle">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>

                {slotsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-text-secondary gap-3">
                    <Loader2 className="animate-spin text-accent" size={24} />
                    <span className="text-xs font-medium">Checking live staff schedules...</span>
                  </div>
                ) : slotsError ? (
                  <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                    {slotsError}
                  </div>
                ) : !isBranchOpenToday ? (
                  <div className="p-6 rounded-2xl bg-amber-50 text-amber-800 text-xs border border-amber-200 text-center space-y-1">
                    <div className="font-bold text-sm">Branch Closed on this Day</div>
                    <p>Operating hours indicate this branch is not taking appointments on this weekday. Please select another date.</p>
                  </div>
                ) : allSlots.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-surface-muted text-text-secondary text-xs border border-border-strong text-center space-y-2">
                    <CalendarIcon size={32} className="mx-auto text-text-muted" />
                    <div className="font-bold text-sm text-primary">No Available Appointment Slots</div>
                    <p className="max-w-xs mx-auto">
                      All professionals are occupied or off-duty for this date. Please pick another date on the calendar.
                    </p>
                  </div>
                ) : (
                  <div>
                    {availableSlots.length === 0 && (
                      <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200">
                        All slots on this date are currently fully booked. Unavailable slots are indicated below.
                      </div>
                    )}

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {allSlots.map((slot, sIdx) => {
                        const isAvailable = slot.isAvailable !== false;
                        const isSelected = selectedSlot?.startTime === slot.startTime;

                        return (
                          <button
                            key={sIdx}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => isAvailable && setSelectedSlot(slot)}
                            title={
                              !isAvailable
                                ? slot.reason === 'OUTSIDE_BRANCH_HOURS'
                                  ? 'Outside business hours'
                                  : 'Slot fully booked'
                                : `Available: ${slot.startTime} to ${slot.endTime}`
                            }
                            className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border ${
                              !isAvailable
                                ? 'bg-surface-muted/40 text-text-muted/60 border-border-subtle cursor-not-allowed line-through opacity-50'
                                : isSelected
                                ? 'bg-accent text-white border-accent shadow-md shadow-accent/25 ring-2 ring-accent/30 scale-[1.02]'
                                : 'bg-white text-primary border-border-strong hover:border-accent hover:text-accent cursor-pointer shadow-sm'
                            }`}
                          >
                            <div>{slot.startTime}</div>
                            <div className="text-[10px] font-normal opacity-80 mt-0.5">
                              {slot.endTime}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Complete Booking Summary & Request CTA (5 Cols) */}
            <div className="lg:col-span-5">
              <div className="bg-surface rounded-3xl p-6 lg:p-8 border border-border-strong/70 shadow-sm sticky top-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-primary">Booking Summary</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Review your appointment details before submitting.
                  </p>
                </div>

                {/* Summary Table */}
                <div className="space-y-3.5 pt-4 border-t border-border-subtle text-sm">
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-text-secondary text-xs font-medium">Business</span>
                    <span className="font-bold text-primary text-right">{businessName}</span>
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <span className="text-text-secondary text-xs font-medium">Service</span>
                    <span className="font-bold text-primary text-right">{selectedService.name}</span>
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <span className="text-text-secondary text-xs font-medium">Location</span>
                    <span className="font-semibold text-primary text-right text-xs">
                      {effectiveLocationType === 'AT_BRANCH' ? (
                        <span className="inline-flex items-center gap-1">
                          <Store size={12} className="text-accent shrink-0" />
                          <span>Workshop ({branchInfo?.address || 'At Branch'})</span>
                        </span>
                      ) : selectedAddress ? (
                        <span className="inline-flex items-start gap-1">
                          <Home size={12} className="text-accent shrink-0 mt-0.5" />
                          <span>
                            {selectedAddress.streetAddress}, {selectedAddress.city} {selectedAddress.state}{' '}
                            {selectedAddress.postcode}
                          </span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold inline-flex items-center gap-1">
                          <AlertCircle size={12} /> Address Required
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <span className="text-text-secondary text-xs font-medium">Duration</span>
                    <span className="font-semibold text-primary">{selectedService.durationMins} mins</span>
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <span className="text-text-secondary text-xs font-medium">Date</span>
                    <span className="font-semibold text-primary text-right">
                      {selectedDate
                        ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '---'}
                    </span>
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <span className="text-text-secondary text-xs font-medium">Time Slot</span>
                    <span className="font-bold text-accent text-right">
                      {selectedSlot ? `${selectedSlot.startTime} – ${selectedSlot.endTime}` : 'Select a time slot'}
                    </span>
                  </div>

                  {selectedService.price > 0 && (
                    <div className="pt-3 border-t border-border-subtle flex justify-between items-baseline">
                      <span className="text-sm font-bold text-text-secondary">Estimated Total</span>
                      <span className="text-xl font-extrabold text-brand-navy">
                        {formatAudPrice(selectedService.price)} <span className="text-xs">AUD</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Customer Notes */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">
                    Special Requests or Vehicle Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="e.g. Rego number, specific issues, or gate access code..."
                    className="w-full p-3 rounded-xl border border-border-strong text-xs text-primary focus:outline-none focus:ring-2 focus:ring-accent bg-white resize-none placeholder:text-text-muted"
                  />
                </div>

                {/* Booking Error Banner */}
                {bookingError && (
                  <div className="p-3.5 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <span>{bookingError}</span>
                  </div>
                )}

                {/* Request CTA Button */}
                <div>
                  <button
                    type="button"
                    disabled={
                      !selectedSlot ||
                      bookingStatus === 'submitting' ||
                      (effectiveLocationType === 'CUSTOMER_LOCATION' && !selectedAddressId)
                    }
                    onClick={handleBooking}
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                      !selectedSlot ||
                      bookingStatus === 'submitting' ||
                      (effectiveLocationType === 'CUSTOMER_LOCATION' && !selectedAddressId)
                        ? 'bg-surface-muted text-text-muted border border-border-strong cursor-not-allowed shadow-none'
                        : 'bg-accent text-white hover:bg-accent/90 shadow-accent/20 cursor-pointer'
                    }`}
                  >
                    {bookingStatus === 'submitting' ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        <span>Securing Your Slot...</span>
                      </>
                    ) : (
                      <>
                        <span>Request Appointment</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  {effectiveLocationType === 'CUSTOMER_LOCATION' && !selectedAddressId ? (
                    <p className="text-xs text-center text-rose-600 font-semibold mt-2.5 flex items-center justify-center gap-1.5">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>Please select or add a service address to proceed</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-center text-text-secondary mt-3">
                      Appointment requires confirmation from {businessName}. No immediate payment required.
                    </p>
                  )}
                </div>

                {/* Trust / Security Badge */}
                <div className="p-3 rounded-xl bg-surface-lavender/60 border border-border-subtle flex items-center gap-2.5 text-[11px] text-text-secondary">
                  <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                  <span>Your booking is secured by transaction-level serialization locks.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
