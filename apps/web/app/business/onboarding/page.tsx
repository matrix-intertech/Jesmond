'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, User, setCurrentUser, getAccessToken } from '@/utils/auth';
import { checkBusinessAccess, logoutBusinessSession } from '@/utils/sso';
import { cleanAbn, formatAbn, validateAbnChecksum } from '@/utils/abn';
import {
  Building2,
  Briefcase,
  Store,
  Hotel,
  Utensils,
  Wrench,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  LogOut,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  FileCheck2,
  Check,
  RotateCcw,
} from 'lucide-react';

export type BusinessCategoryType = 'ACCOMMODATION' | 'RETAIL' | 'FOOD' | 'SERVICES';

interface OnboardingFormState {
  step: number;
  category: BusinessCategoryType;
  // Step 2: Legal & Identity
  organizationName: string;
  legalName: string;
  abn: string;
  abnExempt: boolean;
  phone: string;
  businessEmail: string;
  website: string;
  // Step 3: Location & Hours
  address: string;
  city: string;
  state: string;
  postcode: string;
  operatingHours: string;
  // Step 4: Category Specific
  // Accommodation
  portfolioSize: string;
  defaultLeaseTerm: string;
  maintenancePhone: string;
  // Retail
  branchName: string;
  posTerminalLabel: string;
  returnPolicy: string;
  // Food
  venueType: string;
  takeawayEnabled: boolean;
  prepTime: string;
  // Services
  serviceModel: string;
  slotDuration: string;
  cancellationWindow: string;
}

const DEFAULT_STATE: OnboardingFormState = {
  step: 1,
  category: 'ACCOMMODATION',
  organizationName: '',
  legalName: '',
  abn: '',
  abnExempt: false,
  phone: '',
  businessEmail: '',
  website: '',
  address: '',
  city: '',
  state: 'NSW',
  postcode: '',
  operatingHours: 'Monday - Friday: 09:00 - 17:00',
  portfolioSize: '1-5 Rooms / Properties',
  defaultLeaseTerm: '12 Months',
  maintenancePhone: '',
  branchName: 'Main Store',
  posTerminalLabel: 'Register 1 - Counter',
  returnPolicy: '30-day exchange with original receipt',
  venueType: 'Cafe & Bistro',
  takeawayEnabled: true,
  prepTime: '15-20 mins',
  serviceModel: 'In-Studio & Workshop',
  slotDuration: '30 Minutes',
  cancellationWindow: '24 Hours',
};

const STORAGE_KEY = 'jesmond_business_onboarding_draft';

function BusinessOnboardingContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [abnError, setAbnError] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

  // Wizard state
  const [form, setForm] = useState<OnboardingFormState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('Failed to parse onboarding draft:', e);
      }
    }
    return DEFAULT_STATE;
  });

  // Save draft on changes
  useEffect(() => {
    if (typeof window !== 'undefined' && !isCompleted) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      } catch (e) {
        // quota exceeded or storage disabled
      }
    }
  }, [form, isCompleted]);

  useEffect(() => {
    const init = async () => {
      const cur = getCurrentUser();
      if (!cur) {
        router.replace('/business/login');
        return;
      }
      setUser(cur);

      if (!form.businessEmail && cur.email) {
        setForm((prev) => ({ ...prev, businessEmail: cur.email }));
      }

      // Check existing business organization access
      try {
        const status = await checkBusinessAccess();
        if (status.hasBusinessAccess) {
          router.replace('/portal');
          return;
        }
      } catch (err) {
        console.warn('Business access check error:', err);
      } finally {
        setChecking(false);
      }
    };
    init();
  }, [router, form.businessEmail]);

  // Form field updater
  const updateField = <K extends keyof OnboardingFormState>(key: K, value: OnboardingFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  // ABN validation helper
  const handleAbnChange = (val: string) => {
    const clean = cleanAbn(val);
    updateField('abn', formatAbn(clean));
    if (clean.length === 11) {
      const isValid = validateAbnChecksum(clean);
      if (!isValid) {
        setAbnError('Invalid Australian Business Number checksum.');
      } else {
        setAbnError('');
      }
    } else {
      setAbnError('');
    }
  };

  // Step navigation validations
  const handleNextStep = () => {
    setError('');

    if (form.step === 1) {
      // Category selected
      setForm((prev) => ({ ...prev, step: 2 }));
      return;
    }

    if (form.step === 2) {
      // Validate Legal & Identity
      if (!form.organizationName.trim()) {
        setError('Trading Name or Organization Name is required.');
        return;
      }
      if (!form.abnExempt && form.abn.trim()) {
        const clean = cleanAbn(form.abn);
        if (clean.length !== 11 || !validateAbnChecksum(clean)) {
          setError('Please provide a valid 11-digit ABN or select the exemption option.');
          return;
        }
      }
      if (!form.phone.trim()) {
        setError('Primary business contact telephone is required.');
        return;
      }
      setForm((prev) => ({ ...prev, step: 3 }));
      return;
    }

    if (form.step === 3) {
      // Validate Location
      if (!form.address.trim()) {
        setError('Physical business street address is required.');
        return;
      }
      if (!form.city.trim()) {
        setError('City or Suburb is required.');
        return;
      }
      if (!form.postcode.trim()) {
        setError('Postcode is required.');
        return;
      }
      setForm((prev) => ({ ...prev, step: 4 }));
      return;
    }

    if (form.step === 4) {
      // Validate Category Specific Details
      if (form.category === 'ACCOMMODATION' && !form.maintenancePhone.trim()) {
        updateField('maintenancePhone', form.phone);
      }
      setForm((prev) => ({ ...prev, step: 5 }));
      return;
    }
  };

  const handlePrevStep = () => {
    setError('');
    setForm((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) }));
  };

  // Step 5: Final Submission with Server-Verified Onboarding Ticket
  const handleFinalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.organizationName.trim()) {
      setError('Organization name is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = getAccessToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // 1. Request server-verified single-use onboarding token
      const initRes = await fetch(`${apiUrl}/api/v1/organizations/onboard/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!initRes.ok) {
        const initData = await initRes.json().catch(() => ({}));
        throw new Error(initData.message || 'Failed to initiate server-verified business onboarding.');
      }

      const { onboardingToken } = await initRes.json();

      // Determine OrgType
      const orgType = form.category === 'ACCOMMODATION' ? 'PROVIDER' : 'RETAIL';
      const fullAddress = `${form.address}, ${form.city} ${form.state} ${form.postcode}`.trim();

      // 2. Submit organization profile with server-verified token & atomic burn
      const res = await fetch(`${apiUrl}/api/v1/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Onboarding-Token': onboardingToken,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          name: form.organizationName.trim(),
          type: orgType,
          businessCategory: form.category === 'ACCOMMODATION' ? 'RENTALS' : form.category,
          onboardingToken,
          abn: form.abn ? cleanAbn(form.abn) : undefined,
          phone: form.phone.trim(),
          address: fullAddress,
          settings: {
            legalName: form.legalName.trim() || form.organizationName.trim(),
            businessEmail: form.businessEmail.trim(),
            website: form.website.trim(),
            operatingHours: form.operatingHours,
            categoryConfig: {
              category: form.category,
              portfolioSize: form.portfolioSize,
              defaultLeaseTerm: form.defaultLeaseTerm,
              maintenancePhone: form.maintenancePhone || form.phone,
              branchName: form.branchName,
              posTerminalLabel: form.posTerminalLabel,
              returnPolicy: form.returnPolicy,
              venueType: form.venueType,
              takeawayEnabled: form.takeawayEnabled,
              prepTime: form.prepTime,
              serviceModel: form.serviceModel,
              slotDuration: form.slotDuration,
              cancellationWindow: form.cancellationWindow,
            },
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to initialize business organization.');
      }

      const createdOrg = await res.json();
      setCreatedOrgId(createdOrg.id);

      // Update current user in auth session
      if (user) {
        const updatedUser: User = {
          ...user,
          role: 'ORG_STAFF',
          organizationId: createdOrg.id,
          orgRole: 'OWNER',
          orgType: createdOrg.type,
          businessCategory: createdOrg.businessCategory,
        };
        setCurrentUser(updatedUser);
      }

      // Clear draft
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(STORAGE_KEY);
      }

      setIsCompleted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to complete business onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get destination dashboard URL based on category
  const getDestinationDashboard = useCallback(() => {
    switch (form.category) {
      case 'ACCOMMODATION':
        return '/portal';
      case 'RETAIL':
        return '/portal/retail';
      case 'FOOD':
        return '/portal/business/orders';
      case 'SERVICES':
        return '/portal/business/appointments';
      default:
        return '/portal';
    }
  }, [form.category]);

  const handleLaunchDashboard = () => {
    router.push(getDestinationDashboard());
  };

  if (checking) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <span className="text-sm">Verifying organization access...</span>
      </div>
    );
  }

  // =========================================================================
  // STEP 6: COMPLETION SCREEN
  // =========================================================================
  if (isCompleted) {
    return (
      <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto w-full">
        <div className="bg-slate-950/95 border border-slate-800 p-8 sm:p-10 rounded-3xl shadow-2xl backdrop-blur-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 mb-3">
            <Clock className="w-3.5 h-3.5" />
            <span>Status: Pending Credential Verification</span>
          </span>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-outfit">
            Your Business Workspace is Ready
          </h1>

          <p className="mt-2 text-sm text-slate-300 max-w-md mx-auto">
            <span className="font-semibold text-white">{form.organizationName}</span> has been created on the Jesmond Commercial Portal.
          </p>

          <div className="mt-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-left text-xs space-y-3">
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Operational Dashboard Active: </span>
                <span className="text-slate-300">You can immediately configure products, properties, menus, staff members, and store terminals.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Public Marketplace Visibility: </span>
                <span className="text-slate-300">Public student bookings and customer checkouts will activate once regulatory credentials (ABN and industry licenses) are verified.</span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={handleLaunchDashboard}
              className="w-full py-3.5 px-5 rounded-xl text-white font-semibold text-sm bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              <span>Launch Business Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              href="/portal/business/verification"
              className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <FileCheck2 className="w-4 h-4 text-indigo-400" />
              <span>Submit Verification Documents Now</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MULTI-STEP ONBOARDING WIZARD
  // =========================================================================
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
      <div className="bg-slate-950/95 border border-slate-800 p-8 sm:p-10 rounded-3xl shadow-2xl backdrop-blur-xl">
        
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">
            Welcome to Jesmond Business
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Signed in as <span className="font-semibold text-slate-200">{user?.email}</span>
          </p>
          <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 max-w-lg mx-auto">
            Your identity is active, but you do not yet have a registered commercial organization or property host profile. Set up your organization below to enter the Business Portal.
          </div>
        </div>

        {/* Progress Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span className={form.step >= 1 ? 'text-indigo-400 font-semibold' : ''}>1. Category</span>
            <span className={form.step >= 2 ? 'text-indigo-400 font-semibold' : ''}>2. Identity</span>
            <span className={form.step >= 3 ? 'text-indigo-400 font-semibold' : ''}>3. Location</span>
            <span className={form.step >= 4 ? 'text-indigo-400 font-semibold' : ''}>4. Operations</span>
            <span className={form.step >= 5 ? 'text-indigo-400 font-semibold' : ''}>5. Review</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full transition-all duration-300"
              style={{ width: `${(form.step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start gap-3"
          >
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 1: BUSINESS CATEGORY SELECTION                                 */}
        {/* =================================================================== */}
        {form.step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-white mb-1">Select Your Primary Business Domain</h2>
              <p className="text-xs text-slate-400">
                Choose the operational sector for your commercial workspace. This configures your dashboard tools and compliance rules.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  id: 'ACCOMMODATION' as BusinessCategoryType,
                  label: 'Accommodation Provider',
                  desc: 'Student housing, private rental units, hostels, lease agreements & tenant maintenance.',
                  icon: Hotel,
                  color: 'text-indigo-400',
                  bg: 'bg-indigo-500/10 border-indigo-500/30',
                },
                {
                  id: 'RETAIL' as BusinessCategoryType,
                  label: 'Retail Merchant',
                  desc: 'In-store POS registers, barcode scanning, omnichannel stock catalog & customer receipts.',
                  icon: Store,
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-500/10 border-emerald-500/30',
                },
                {
                  id: 'FOOD' as BusinessCategoryType,
                  label: 'Food & Dining',
                  desc: 'Restaurants, cafes, live kitchen display (KDS), takeaway dispatch & digital menus.',
                  icon: Utensils,
                  color: 'text-amber-400',
                  bg: 'bg-amber-500/10 border-amber-500/30',
                },
                {
                  id: 'SERVICES' as BusinessCategoryType,
                  label: 'Services & Trades',
                  desc: 'Appointment calendars, client booking windows, repairs, trades, and personal services.',
                  icon: Wrench,
                  color: 'text-blue-400',
                  bg: 'bg-blue-500/10 border-blue-500/30',
                },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = form.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => updateField('category', cat.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/40 shadow-lg ring-1 ring-indigo-500'
                        : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cat.bg}`}>
                          <Icon className={`w-5 h-5 ${cat.color}`} />
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white">{cat.label}</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{cat.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div>
              <label htmlFor="org-name-step1" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Trading Name / Organization Name *
              </label>
              <input
                id="org-name-step1"
                name="organizationName"
                type="text"
                required
                value={form.organizationName}
                onChange={(e) => updateField('organizationName', e.target.value)}
                placeholder="Trading Name (e.g. Matrix Store, Jesmond Lodge)"
                className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleNextStep}
                aria-label="Continue to Profile — Launch Business Dashboard"
                className="py-3 px-6 rounded-xl text-white font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md shadow-indigo-600/20"
              >
                <span>Continue to Profile</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 2: BUSINESS IDENTITY & CONTACT                                 */}
        {/* =================================================================== */}
        {form.step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-white mb-1">Business Identity & Legal Profile</h2>
              <p className="text-xs text-slate-400">
                Enter your commercial trading details and Australian Business identification.
              </p>
            </div>

            <div>
              <label htmlFor="org-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Trading Name / Organization Name *
              </label>
              <input
                id="org-name"
                name="organizationName"
                type="text"
                required
                value={form.organizationName}
                onChange={(e) => updateField('organizationName', e.target.value)}
                placeholder="Trading Name (e.g. Matrix Store, Jesmond Lodge)"
                className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="legal-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Legal Entity Name (Optional)
                </label>
                <input
                  id="legal-name"
                  type="text"
                  value={form.legalName}
                  onChange={(e) => updateField('legalName', e.target.value)}
                  placeholder="e.g. Matrix Pty Ltd"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="abn" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Australian Business Number (ABN)
                </label>
                <input
                  id="abn"
                  type="text"
                  disabled={form.abnExempt}
                  value={form.abn}
                  onChange={(e) => handleAbnChange(e.target.value)}
                  placeholder="XX XXX XXX XXX"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono disabled:opacity-50"
                />
                {abnError && <p className="text-xs text-red-400 mt-1">{abnError}</p>}
                <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.abnExempt}
                    onChange={(e) => {
                      updateField('abnExempt', e.target.checked);
                      if (e.target.checked) setAbnError('');
                    }}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-400">Sole Trader / Operating under ABN Exemption</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Business Phone Number *
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="02 9000 0000 or 0400 000 000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="biz-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Business Contact Email
                </label>
                <input
                  id="biz-email"
                  type="email"
                  value={form.businessEmail}
                  onChange={(e) => updateField('businessEmail', e.target.value)}
                  placeholder="contact@business.com.au"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="website" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Website or Social Page (Optional)
              </label>
              <input
                id="website"
                type="url"
                value={form.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://www.yourbusiness.com.au"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handlePrevStep}
                className="py-2.5 px-4 rounded-xl text-slate-400 hover:text-white font-medium text-xs transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="py-3 px-6 rounded-xl text-white font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md shadow-indigo-600/20"
              >
                <span>Continue to Location</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3: LOCATION & OPERATING HOURS                                 */}
        {/* =================================================================== */}
        {form.step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-white mb-1">Primary Location & Operating Schedule</h2>
              <p className="text-xs text-slate-400">
                Provide your primary physical premises or head office location in Australia.
              </p>
            </div>

            <div>
              <label htmlFor="address" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Street Address *
              </label>
              <input
                id="address"
                type="text"
                required
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="e.g. 100 University Drive"
                className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="city" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Suburb / City *
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="Newcastle"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  State *
                </label>
                <select
                  id="state"
                  value={form.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="NSW">NSW (New South Wales)</option>
                  <option value="VIC">VIC (Victoria)</option>
                  <option value="QLD">QLD (Queensland)</option>
                  <option value="WA">WA (Western Australia)</option>
                  <option value="SA">SA (South Australia)</option>
                  <option value="TAS">TAS (Tasmania)</option>
                  <option value="ACT">ACT (Australian Capital Territory)</option>
                  <option value="NT">NT (Northern Territory)</option>
                </select>
              </div>

              <div>
                <label htmlFor="postcode" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Postcode *
                </label>
                <input
                  id="postcode"
                  type="text"
                  required
                  maxLength={4}
                  value={form.postcode}
                  onChange={(e) => updateField('postcode', e.target.value.replace(/\D/g, ''))}
                  placeholder="2308"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="hours" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Standard Operating Hours / Availability
              </label>
              <input
                id="hours"
                type="text"
                value={form.operatingHours}
                onChange={(e) => updateField('operatingHours', e.target.value)}
                placeholder="Monday - Friday: 09:00 - 17:00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handlePrevStep}
                className="py-2.5 px-4 rounded-xl text-slate-400 hover:text-white font-medium text-xs transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="py-3 px-6 rounded-xl text-white font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md shadow-indigo-600/20"
              >
                <span>Continue to Operations</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 4: CATEGORY-SPECIFIC OPERATIONAL SETUP                          */}
        {/* =================================================================== */}
        {form.step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-white mb-1">
                {form.category === 'ACCOMMODATION' && 'Accommodation & Property Settings'}
                {form.category === 'RETAIL' && 'Retail POS & Terminal Configuration'}
                {form.category === 'FOOD' && 'Dining & Kitchen Configuration'}
                {form.category === 'SERVICES' && 'Service Scheduling & Calendar Settings'}
              </h2>
              <p className="text-xs text-slate-400">
                Tailor your initial workspace defaults for {form.category.toLowerCase()} operations.
              </p>
            </div>

            {/* Accommodation Specific Fields */}
            {form.category === 'ACCOMMODATION' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="portfolio-size" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Portfolio Scale
                  </label>
                  <select
                    id="portfolio-size"
                    value={form.portfolioSize}
                    onChange={(e) => updateField('portfolioSize', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="1-5 Rooms / Units">1-5 Rooms / Private Units</option>
                    <option value="6-20 Rooms">6-20 Rooms / Shared Housing</option>
                    <option value="20+ Enterprise Units">20+ Enterprise Student Accommodation</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="lease-term" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Default Minimum Student Lease Period
                  </label>
                  <select
                    id="lease-term"
                    value={form.defaultLeaseTerm}
                    onChange={(e) => updateField('defaultLeaseTerm', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="Flexible / Semester">Flexible / Single Semester (6 Months)</option>
                    <option value="12 Months">Full Academic Year (12 Months)</option>
                    <option value="Short-Stay">Short-Stay / Summer Accommodation</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="maintenance-phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    24/7 Tenant Maintenance Hotline (Optional)
                  </label>
                  <input
                    id="maintenance-phone"
                    type="tel"
                    value={form.maintenancePhone}
                    onChange={(e) => updateField('maintenancePhone', e.target.value)}
                    placeholder="Defaults to business phone if blank"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Retail Specific Fields */}
            {form.category === 'RETAIL' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="branch-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Primary Store Branch Name
                  </label>
                  <input
                    id="branch-name"
                    type="text"
                    value={form.branchName}
                    onChange={(e) => updateField('branchName', e.target.value)}
                    placeholder="e.g. Campus Store, Central Branch"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="pos-label" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Initial POS Terminal Label
                  </label>
                  <input
                    id="pos-label"
                    type="text"
                    value={form.posTerminalLabel}
                    onChange={(e) => updateField('posTerminalLabel', e.target.value)}
                    placeholder="e.g. Counter Register 1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="return-policy" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Store Return & Refund Policy Summary
                  </label>
                  <input
                    id="return-policy"
                    type="text"
                    value={form.returnPolicy}
                    onChange={(e) => updateField('returnPolicy', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Food Specific Fields */}
            {form.category === 'FOOD' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="venue-type" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Venue Type
                  </label>
                  <select
                    id="venue-type"
                    value={form.venueType}
                    onChange={(e) => updateField('venueType', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="Cafe & Bistro">Cafe & Bistro</option>
                    <option value="Full Service Restaurant">Full Service Restaurant</option>
                    <option value="Quick Service / Takeaway">Quick Service / Takeaway</option>
                    <option value="Food Truck / Pop-up">Food Truck / Pop-up</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={form.takeawayEnabled}
                      onChange={(e) => updateField('takeawayEnabled', e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-300 font-semibold">Enable Mobile Student Takeaway Orders</span>
                  </label>
                </div>

                <div>
                  <label htmlFor="prep-time" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Average Preparation Time
                  </label>
                  <select
                    id="prep-time"
                    value={form.prepTime}
                    onChange={(e) => updateField('prepTime', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="10-15 mins">10-15 mins (Quick prep)</option>
                    <option value="15-25 mins">15-25 mins (Standard cafe/restaurant)</option>
                    <option value="25-40 mins">25-40 mins (Dining banquet)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Services Specific Fields */}
            {form.category === 'SERVICES' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="service-model" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Service Delivery Model
                  </label>
                  <select
                    id="service-model"
                    value={form.serviceModel}
                    onChange={(e) => updateField('serviceModel', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="In-Studio & Workshop">In-Studio & Workshop Premises</option>
                    <option value="Mobile / On-site Callout">Mobile / On-site Callout</option>
                    <option value="Hybrid (Both)">Hybrid (Studio & Mobile Callout)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="slot-duration" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Default Appointment Slot Duration
                  </label>
                  <select
                    id="slot-duration"
                    value={form.slotDuration}
                    onChange={(e) => updateField('slotDuration', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="15 Minutes">15 Minutes</option>
                    <option value="30 Minutes">30 Minutes (Standard)</option>
                    <option value="45 Minutes">45 Minutes</option>
                    <option value="60 Minutes">60 Minutes</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="cancel-window" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Notice Required for Cancellation
                  </label>
                  <select
                    id="cancel-window"
                    value={form.cancellationWindow}
                    onChange={(e) => updateField('cancellationWindow', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="12 Hours">12 Hours Notice</option>
                    <option value="24 Hours">24 Hours Notice (Recommended)</option>
                    <option value="48 Hours">48 Hours Notice</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handlePrevStep}
                className="py-2.5 px-4 rounded-xl text-slate-400 hover:text-white font-medium text-xs transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="py-3 px-6 rounded-xl text-white font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md shadow-indigo-600/20"
              >
                <span>Review & Submit</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 5: REVIEW & FINAL SUBMISSION                                  */}
        {/* =================================================================== */}
        {form.step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-white mb-1">Review Your Business Profile</h2>
              <p className="text-xs text-slate-400">
                Verify your organization details before initializing your secure enterprise workspace.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-slate-400">Business Sector</span>
                <span className="font-semibold text-white px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {form.category}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-800">
                <div>
                  <span className="text-slate-400 block">Trading Name</span>
                  <span className="font-semibold text-white text-sm">{form.organizationName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">ABN</span>
                  <span className="font-mono text-white">
                    {form.abnExempt ? 'Exemption Claimed' : (form.abn || 'Not Provided')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-800">
                <div>
                  <span className="text-slate-400 block">Primary Address</span>
                  <span className="text-slate-200">
                    {form.address}, {form.city} {form.state} {form.postcode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Phone</span>
                  <span className="text-slate-200">{form.phone}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Operational Setup</span>
                <span className="text-slate-300">
                  {form.category === 'ACCOMMODATION' && `Portfolio: ${form.portfolioSize} • Lease: ${form.defaultLeaseTerm}`}
                  {form.category === 'RETAIL' && `Branch: ${form.branchName} • POS: ${form.posTerminalLabel}`}
                  {form.category === 'FOOD' && `Venue: ${form.venueType} • Takeaway: ${form.takeawayEnabled ? 'Enabled' : 'Disabled'}`}
                  {form.category === 'SERVICES' && `Model: ${form.serviceModel} • Slot: ${form.slotDuration}`}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Cryptographic Single-Use Ticket: </span>
                <span>
                  Your workspace initialization is authorized via an atomic, server-verified token with single-use nonce consumption.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={loading}
                className="py-2.5 px-4 rounded-xl text-slate-400 hover:text-white font-medium text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleFinalSubmit}
                className="py-3.5 px-7 rounded-xl text-white font-semibold text-xs bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initializing Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Launch Business Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Footer controls: Reset Draft & Logout */}
      <div className="max-w-3xl mx-auto mt-6 flex items-center justify-between text-xs text-slate-500 px-2">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
            setForm(DEFAULT_STATE);
          }}
          className="hover:text-slate-300 inline-flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Draft</span>
        </button>

        <button
          type="button"
          onClick={() => logoutBusinessSession()}
          className="hover:text-red-400 inline-flex items-center gap-1 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export default function BusinessOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <span className="text-sm">Loading onboarding workspace...</span>
        </div>
      }
    >
      <BusinessOnboardingContent />
    </Suspense>
  );
}
