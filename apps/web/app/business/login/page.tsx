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
  Store,
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
    <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-x-hidden">
      {/* Left Info Column — 50% Desktop */}
      <div className="w-full bg-gradient-to-br from-[#24160D] via-[#1A100A] to-[#120D09] p-6 sm:p-10 lg:px-14 lg:py-12 flex flex-col justify-center relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#EA8A32]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#D6A64F]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-xl w-full mx-auto space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D6A64F]/15 border border-[rgba(214,166,79,0.3)] text-[#F3D69A] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#EA8A32]" />
            <span>Partner &amp; Host Gateway</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#FFF9EF] font-outfit tracking-tight leading-tight">
            Manage your enterprise on Jesmond
          </h1>

          <p className="text-sm text-[#C9B69C] leading-relaxed">
            Access your accommodations, retail points of sale, dining menus, service bookings, and tenant requests in one unified business terminal.
          </p>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#120D09]/75 border border-[rgba(214,166,79,0.22)] hover:border-[#D6A64F]/45 hover:bg-[#24160D]/80 transition-colors">
              <div className="p-2.5 rounded-lg bg-[#8B5E34]/25 border border-[#D6A64F]/30 text-[#F3D69A] mt-0.5 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#FFF9EF]">Accommodation &amp; Properties</h4>
                <p className="text-xs text-[#C9B69C] mt-0.5">
                  Manage listings, leases, tenant requests and rental agreements.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#120D09]/75 border border-[rgba(214,166,79,0.22)] hover:border-[#D6A64F]/45 hover:bg-[#24160D]/80 transition-colors">
              <div className="p-2.5 rounded-lg bg-[#EA8A32]/20 border border-[#EA8A32]/35 text-[#EA8A32] mt-0.5 shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#FFF9EF]">Retail &amp; Hospitality POS</h4>
                <p className="text-xs text-[#C9B69C] mt-0.5">
                  Barcode stock management, real-time terminals and food orders.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between text-xs text-[#C9B69C] border-t border-[rgba(214,166,79,0.22)]">
            <span>Are you a student or customer?</span>
            <a
              href="https://jesmond.com.au/login"
              className="text-[#F3D69A] hover:text-[#FFF9EF] font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <span>Customer Sign In</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#EA8A32]" />
            </a>
          </div>
        </div>
      </div>

      {/* Right Login Column — 50% Desktop */}
      <div className="w-full bg-[#1A100A] p-6 sm:p-10 lg:px-14 lg:py-12 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-[rgba(214,166,79,0.22)]">
        <div className="max-w-lg w-full mx-auto bg-[#120D09] border border-[rgba(214,166,79,0.25)] p-7 sm:p-10 rounded-2xl shadow-2xl shadow-black/60">
          <div className="text-center sm:text-left mb-8">
            <h2 className="text-2xl font-bold text-[#FFF9EF] font-outfit">Sign in to Business Portal</h2>
            <p className="text-xs text-[#C9B69C] mt-1">Enter your registered partner credentials to proceed.</p>
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
              <label className="block text-xs font-medium text-[#FFF9EF] mb-1.5">Business Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8B5E34]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@business.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl !bg-[#24160D] !border-[rgba(214,166,79,0.25)] !text-[#FFF9EF] placeholder:!text-[#C9B69C]/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA8A32] focus:!border-[#D6A64F] transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#FFF9EF]">Password</label>
                <Link
                  href="/business/forgot-password"
                  className="text-xs text-[#F3D69A] hover:text-[#FFF9EF] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8B5E34]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl !bg-[#24160D] !border-[rgba(214,166,79,0.25)] !text-[#FFF9EF] placeholder:!text-[#C9B69C]/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA8A32] focus:!border-[#D6A64F] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-[#120D09] bg-gradient-to-r from-[#EA8A32] via-[#D6A64F] to-[#F3D69A] hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#120D09] focus:ring-[#D6A64F] transition-all shadow-lg shadow-[#EA8A32]/20 flex items-center justify-center gap-2 disabled:opacity-50"
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
            <div className="flex-1 border-t border-[rgba(214,166,79,0.2)]" />
            <span className="px-3 text-[11px] text-[#C9B69C] uppercase tracking-wider font-semibold">Or</span>
            <div className="flex-1 border-t border-[rgba(214,166,79,0.2)]" />
          </div>

          <button
            type="button"
            onClick={handleSsoRedirect}
            disabled={ssoLoading}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-[#FFF9EF] bg-[#24160D] hover:bg-[#2F1D12] border border-[rgba(214,166,79,0.3)] transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {ssoLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D6A64F]" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#D6A64F]" />
            )}
            <span>Sign In using Jesmond Single Sign-On (SSO)</span>
          </button>

          <div className="mt-8 pt-6 border-t border-[rgba(214,166,79,0.2)] text-center">
            <p className="text-xs text-[#C9B69C]">
              Don&apos;t have a business or property partner account?{' '}
              <Link
                href="/business/register"
                className="text-[#F3D69A] hover:text-[#FFF9EF] font-semibold transition-colors inline-flex items-center gap-1 whitespace-nowrap"
              >
                Register your organization &rarr;
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusinessLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-[#C9B69C]">
          <Loader2 className="w-6 h-6 animate-spin text-[#D6A64F]" />
        </div>
      }
    >
      <BusinessLoginContent />
    </Suspense>
  );
}
