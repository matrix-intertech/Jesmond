'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  setAccessToken,
  setCurrentUser,
  getDashboardRouteForUser,
  isAuthorizedRouteForUser,
  User,
} from '@/utils/auth';
import {
  checkBusinessAccess,
  initiateSsoAuthorization,
  resolveBusinessAuthDestination,
  applyActiveOrganizationToUser,
  BusinessOrganizationSummary,
} from '@/utils/sso';
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
  Wrench,
  Briefcase,
  Car,
  Utensils,
} from 'lucide-react';

function BusinessLoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [orgChoices, setOrgChoices] = useState<BusinessOrganizationSummary[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelectOrganization = (org: BusinessOrganizationSummary) => {
    if (!pendingUser) return;
    const updatedUser = applyActiveOrganizationToUser(pendingUser, org);
    const returnUrl = searchParams.get('returnUrl');
    if (returnUrl && isAuthorizedRouteForUser(updatedUser, returnUrl)) {
      router.push(returnUrl);
    } else {
      router.push(getDashboardRouteForUser(updatedUser));
    }
  };

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
      const resolution = resolveBusinessAuthDestination(
        data.user,
        businessStatus,
        searchParams.get('returnUrl'),
      );

      if (resolution.action === 'redirect') {
        router.push(resolution.destination);
      } else if (resolution.action === 'select_organization') {
        setPendingUser(data.user);
        setOrgChoices(resolution.organizations);
      } else if (resolution.action === 'onboarding') {
        // Authenticated user exists but has no business organization profile
        router.push('/business/onboarding');
      } else {
        throw new Error(resolution.message);
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
      <div className="w-full bg-gradient-to-br from-[#24160D] via-[#1A100A] to-[#120D09] p-6 sm:p-10 lg:px-12 lg:py-10 flex flex-col justify-center relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#EA8A32]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#D6A64F]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl w-full mx-auto space-y-5 relative z-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D6A64F]/15 border border-[rgba(214,166,79,0.3)] text-[#F3D69A] text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#EA8A32]" />
              <span>Partner &amp; Host Gateway</span>
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#C9B69C]">
              Manage your enterprise on Jesmond
            </h2>
          </div>

          <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-[#FFF9EF] font-outfit tracking-tight leading-tight">
            Everything Your Business Needs. One Connected Platform.
          </h1>

          <p className="text-xs sm:text-sm text-[#C9B69C] leading-relaxed">
            Whether you run an automotive workshop, provide professional trade services, operate a vehicle rental business, manage accommodation or run a retail or hospitality business — Jesmond brings your operations, bookings and customers together in one platform.
          </p>

          {/* Six Business Categories — Responsive 2-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {[
              {
                title: 'Mechanics & Automotive',
                desc: 'Manage workshops, vehicle servicing, repair appointments, bookings and customer requests.',
                examples: 'Mechanics • Automotive workshops • Vehicle servicing and repairs',
                icon: Wrench,
                iconBg: 'bg-[#EA8A32]/20 border-[#EA8A32]/35 text-[#EA8A32]',
              },
              {
                title: 'Services & Tradies',
                desc: 'Manage service listings, job requests, appointments, staff assignments and customer enquiries.',
                examples: 'Electricians • Plumbers • Professional trades • Local service providers',
                icon: Briefcase,
                iconBg: 'bg-[#8B5E34]/25 border-[#D6A64F]/30 text-[#F3D69A]',
              },
              {
                title: 'Rentals & Vehicle Hire',
                desc: 'Manage vehicle rental listings, fleet availability, rental bookings and customer enquiries.',
                examples: 'Car rentals • Vehicle hire businesses • Vehicle rental providers',
                icon: Car,
                iconBg: 'bg-[#EA8A32]/20 border-[#EA8A32]/35 text-[#EA8A32]',
              },
              {
                title: 'Accommodation & Hospitality',
                desc: 'Manage accommodation listings, rooms, property availability, reservations, guest services and rental operations.',
                examples: 'Hotels • Resorts • Holiday accommodation • Property rentals and leasing',
                icon: Building2,
                iconBg: 'bg-[#8B5E34]/25 border-[#D6A64F]/30 text-[#F3D69A]',
              },
              {
                title: 'Retail & Point of Sale',
                desc: 'Manage products, inventory, barcode sales, transactions and retail operations.',
                examples: 'Retail stores • Shops • Point of Sale businesses',
                icon: Store,
                iconBg: 'bg-[#EA8A32]/20 border-[#EA8A32]/35 text-[#EA8A32]',
              },
              {
                title: 'Restaurants & Food Services',
                desc: 'Manage menus, food orders, dining operations and customer experiences.',
                examples: 'Restaurants • Cafes • Food businesses • Hospitality food services',
                icon: Utensils,
                iconBg: 'bg-[#8B5E34]/25 border-[#D6A64F]/30 text-[#F3D69A]',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-[#120D09]/75 border border-[rgba(214,166,79,0.22)] hover:border-[#D6A64F]/45 hover:bg-[#24160D]/80 transition-colors"
                >
                  <div className={`p-2 rounded-lg border mt-0.5 shrink-0 ${item.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-[#FFF9EF]">{item.title}</h4>
                    <p className="text-[11px] text-[#C9B69C] mt-0.5 leading-snug">{item.desc}</p>
                    <p className="text-[10px] text-[#D6A64F]/85 mt-1 leading-snug">{item.examples}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 flex items-center justify-between text-xs text-[#C9B69C] border-t border-[rgba(214,166,79,0.22)]">
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

          {orgChoices.length > 0 ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#24160D] border border-[rgba(214,166,79,0.25)]">
                <p className="text-xs font-semibold text-[#F3D69A]">Select Organization</p>
                <p className="text-xs text-[#C9B69C] mt-1">
                  Your account has access to multiple business organizations. Choose which dashboard to open:
                </p>
              </div>
              <div className="space-y-2">
                {orgChoices.map((org) => (
                  <button
                    key={org.organizationId}
                    type="button"
                    onClick={() => handleSelectOrganization(org)}
                    className="w-full text-left p-4 rounded-xl bg-[#24160D] hover:bg-[#2F1D12] border border-[rgba(214,166,79,0.28)] hover:border-[#EA8A32] transition flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-[#FFF9EF]">{org.organizationName}</div>
                      <div className="text-[11px] text-[#C9B69C] mt-0.5">
                        {org.businessCategory || org.orgType} • Role: {org.role}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#EA8A32] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
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
          )}

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
