'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  setAccessToken,
  setCurrentUser,
  getDashboardRouteForUser,
} from '@/utils/auth';
import { checkBusinessAccess, initiateSsoAuthorization } from '@/utils/sso';
import {
  Building2,
  Lock,
  Mail,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';

function BusinessLoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          router.push(
            `/business/verify?email=${encodeURIComponent(email)}`,
          );
          return;
        }
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      setAccessToken(data.access_token);
      setCurrentUser(data.user);

      // Verify business authorization on backend
      const businessStatus = await checkBusinessAccess();

      if (businessStatus.hasBusinessAccess) {
        const returnUrl = searchParams.get('returnUrl');
        if (returnUrl && returnUrl.startsWith('/portal')) {
          router.push(returnUrl);
        } else {
          router.push(getDashboardRouteForUser(data.user));
        }
      } else {
        // Authenticated user exists but has no business organization profile
        router.push('/business/onboarding');
      }
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('Unable to connect to business authentication server. Please try again later.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSsoRedirect = async () => {
    setError('');
    setSsoLoading(true);
    try {
      const result = await initiateSsoAuthorization({
        clientId: 'jesmond-business-portal',
      });
      window.location.href = result.redirectUrl;
    } catch (err: any) {
      // If user isn't logged in on student portal, send them to student login with return URL
      window.location.href = `https://jesmond.com.au/login?returnUrl=${encodeURIComponent(window.location.href)}`;
    } finally {
      setSsoLoading(false);
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      {/* Left Info Column */}
      <div className="lg:col-span-5 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-purple/10 border border-brand-purple/30 text-brand-purple text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Partner & Host Gateway</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-outfit tracking-tight leading-tight">
          Manage your enterprise on Jesmond
        </h1>

        <p className="text-sm text-slate-400 leading-relaxed">
          Access your accommodations, retail points of sale, dining menus, service bookings, and tenant requests in one unified business terminal.
        </p>

        <div className="space-y-3 pt-2">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400 mt-0.5">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Accommodation & Properties</h4>
              <p className="text-[11px] text-slate-400">Manage listings, leases, tenant requests and rental agreements.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="p-2 rounded-lg bg-purple-950 text-purple-400 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Retail & Hospitality POS</h4>
              <p className="text-[11px] text-slate-400">Barcode stock management, real-time terminals and food orders.</p>
            </div>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800">
          <span>Are you a student or customer?</span>
          <a
            href="https://jesmond.com.au/login"
            className="text-brand-purple hover:text-purple-300 font-semibold inline-flex items-center gap-1 transition-colors"
          >
            <span>Customer Sign In</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Right Login Card */}
      <div className="lg:col-span-7 bg-slate-950/90 border border-slate-800 p-8 sm:p-10 rounded-2xl shadow-2xl shadow-purple-950/20 backdrop-blur-xl">
        <div className="text-center sm:text-left mb-8">
          <h2 className="text-2xl font-bold text-white font-outfit">Sign in to Business Portal</h2>
          <p className="text-xs text-slate-400 mt-1">Enter your registered partner credentials to proceed.</p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start gap-3"
          >
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Business Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@business.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">Password</label>
              <Link
                href="/business/forgot-password"
                className="text-xs text-brand-purple hover:text-purple-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
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
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-purple to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-brand-purple transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Enterprise Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-slate-800" />
          <span className="px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Or</span>
          <div className="flex-1 border-t border-slate-800" />
        </div>

        <button
          type="button"
          onClick={handleSsoRedirect}
          disabled={ssoLoading}
          className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 transition flex items-center justify-center gap-2"
        >
          {ssoLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
          )}
          <span>Sign In using Jesmond Single Sign-On (SSO)</span>
        </button>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Don&apos;t have a business or property partner account?{' '}
            <Link
              href="/business/register"
              className="text-brand-purple hover:text-purple-300 font-semibold transition-colors"
            >
              Register your organization &rarr;
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BusinessLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <BusinessLoginContent />
    </Suspense>
  );
}
