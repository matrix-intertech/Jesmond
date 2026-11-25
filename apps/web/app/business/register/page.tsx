'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Turnstile from '@/components/ui/Turnstile';
import { CountrySelector } from '@/components/ui/CountrySelector';
import {
  Building2,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  Calendar,
  Briefcase,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Store,
  Hotel,
  Utensils,
  Wrench,
} from 'lucide-react';

function BusinessRegisterContent() {
  const router = useRouter();

  const [businessCategory, setBusinessCategory] = useState<'ACCOMMODATION' | 'RETAIL' | 'FOOD' | 'SERVICES'>('ACCOMMODATION');
  const [organizationName, setOrganizationName] = useState('');
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+61');
  const [phone, setPhone] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('AU');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);
  const handleTurnstileError = useCallback(() => {
    setTurnstileToken('');
    setError('Security verification failed. Please try again.');
  }, []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(''), []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!organizationName.trim()) {
      setError('Organization or Business Trading Name is required.');
      return;
    }
    if (!name.trim()) {
      setError('Primary contact name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Business email is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required.');
      return;
    }
    if (!dateOfBirth) {
      setError('Date of birth is required for regulatory identity verification.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Partner';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          firstName,
          lastName,
          countryCode,
          phone: phone.trim(),
          countryOfOrigin: countryOfOrigin || undefined,
          dateOfBirth: new Date(dateOfBirth).toISOString(),
          organizationName: organizationName.trim(),
          organizationType: businessCategory === 'ACCOMMODATION' ? 'PROVIDER' : 'RETAIL',
          businessCategory,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      // Redirect to business verification page with email prefilled
      router.push(`/business/verify?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('Unable to connect to the authentication service. Please try again later.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      <div className="bg-slate-950/90 border border-slate-800 p-8 sm:p-10 rounded-2xl shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-purple/10 border border-brand-purple/30 text-brand-purple text-xs font-semibold uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Commercial Onboarding</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">
            Register Your Business on Jesmond
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto">
            Create an enterprise partner account to list accommodations, operate POS retail stores, manage menus, or schedule service appointments.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start gap-3"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
          {/* Business Category Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Select Primary Business Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  id: 'ACCOMMODATION',
                  label: 'Accommodation',
                  desc: 'Hostels, apartments, student housing',
                  icon: Hotel,
                },
                {
                  id: 'RETAIL',
                  label: 'Retail Store',
                  desc: 'POS, barcode inventory, catalog',
                  icon: Store,
                },
                {
                  id: 'FOOD',
                  label: 'Food & Dining',
                  desc: 'Restaurants, cafes, online ordering',
                  icon: Utensils,
                },
                {
                  id: 'SERVICES',
                  label: 'Services & Trades',
                  desc: 'Auto mechanics, cleaning, repair',
                  icon: Wrench,
                },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = businessCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setBusinessCategory(cat.id as any)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-brand-purple/20 border-brand-purple text-white shadow-lg shadow-purple-900/20 ring-1 ring-brand-purple'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${isSelected ? 'text-brand-purple' : 'text-slate-500'}`} />
                    <div>
                      <div className="font-semibold text-xs text-slate-200">{cat.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{cat.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Organization Details */}
          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Organization Details
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Business / Trading Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Briefcase className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="e.g. Jesmond City Suites or Matrix Cafe"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Primary Representative Contact */}
          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Primary Partner Representative
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Business Email <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@organization.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-20 px-2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0412 345 678"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Date of Birth <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Credentials */}
          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Account Security
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Create Password (min. 8 characters) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>
              </div>
            </div>
          </div>

          <Turnstile
            onVerify={handleTurnstileVerify}
            onError={handleTurnstileError}
            onExpire={handleTurnstileExpire}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-purple to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-brand-purple transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Registering Enterprise Profile...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Create Business Account</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Already have an active business or host account?{' '}
            <Link
              href="/business/login"
              className="text-brand-purple hover:text-purple-300 font-semibold transition-colors"
            >
              Sign In to Business Portal &rarr;
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BusinessRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <BusinessRegisterContent />
    </Suspense>
  );
}
