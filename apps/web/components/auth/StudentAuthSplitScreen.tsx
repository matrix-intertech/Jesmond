'use client';
import { getApiUrl } from '@/utils/api';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  setAccessToken,
  setCurrentUser,
  getDashboardRouteForUser,
  isAuthorizedRouteForUser,
  isBusinessHost,
  establishSharedSession,
} from '@/utils/auth';
import { getBusinessPortalUrl } from '@/utils/sso';
import { CountrySelector } from '@/components/ui/CountrySelector';
import Turnstile from '@/components/ui/Turnstile';
import {
  GraduationCap,
  Building2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Lock,
  Mail,
  User,
  Phone,
  Calendar,
  ArrowLeft,
  RefreshCw,
  Store,
  Utensils,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

export type AuthMode = 'login' | 'register' | 'forgot' | 'verify';

interface StudentAuthSplitScreenProps {
  initialMode?: AuthMode;
}

function StudentAuthContent({ initialMode = 'login' }: StudentAuthSplitScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode management
  const [mode, setMode] = useState<AuthMode>(() => {
    const queryMode = searchParams.get('mode') as AuthMode | null;
    if (queryMode && ['login', 'register', 'forgot', 'verify'].includes(queryMode)) {
      return queryMode;
    }
    if (searchParams.get('verify') === 'true') {
      return 'verify';
    }
    return initialMode;
  });

  // Common fields
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Login specific
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Register specific
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [countryCode, setCountryCode] = useState('+61');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  // Verify OTP specific
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const lastVerificationAttemptRef = useRef<string | null>(null);
  const verificationInFlightRef = useRef(false);

  // Business Portal URL
  const [businessPortalUrl, setBusinessPortalUrl] = useState('https://business.jesmond.com.au');

  useEffect(() => {
    setBusinessPortalUrl(getBusinessPortalUrl());
  }, []);

  // Update mode or email if query params change
  useEffect(() => {
    const paramEmail = searchParams.get('email');
    if (paramEmail && !email) {
      setEmail(paramEmail);
    }
    if (searchParams.get('verify') === 'true') {
      setMode('verify');
    }
  }, [searchParams, email]);

  // Turnstile handlers
  const handleTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);
  const handleTurnstileError = useCallback(() => {
    setTurnstileToken('');
    setError('Security verification failed. Please refresh.');
  }, []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(''), []);

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Mode switcher helper
  const switchMode = (newMode: AuthMode) => {
    setError('');
    setSuccessMessage('');
    setMode(newMode);
  };

  const routeAfterAuth = useCallback(
    async (authenticatedUser: any, returnUrl?: string | null) => {
      const hasOrgContext = !!(
        authenticatedUser?.organizationId ||
        authenticatedUser?.orgType ||
        authenticatedUser?.businessCategory
      );

      if (authenticatedUser?.role === 'ORG_STAFF' && hasOrgContext && !isBusinessHost()) {
        const targetPath =
          returnUrl && isAuthorizedRouteForUser(authenticatedUser, returnUrl)
            ? returnUrl
            : getDashboardRouteForUser(authenticatedUser);
        window.location.href = `${getBusinessPortalUrl()}${targetPath}`;
        return;
      }

      if (returnUrl && isAuthorizedRouteForUser(authenticatedUser, returnUrl)) {
        router.push(returnUrl);
      } else {
        router.push(getDashboardRouteForUser(authenticatedUser));
      }
    },
    [router],
  );

  // 1. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          switchMode('verify');
          setResendCooldown(60);
          return;
        }
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      if (data.mfaRequired && data.mfaToken) {
        setMfaToken(data.mfaToken);
        setMfaCode('');
        return;
      }

      setAccessToken(data.access_token);
      setCurrentUser(data.user);
      await establishSharedSession(data.access_token, data.user?.organizationId);

      await routeAfterAuth(data.user, searchParams.get('returnUrl'));
    } catch (err: any) {
      setError(err.message === 'Failed to fetch' ? 'Unable to connect to server. Please try again.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError('');
    setLoading(true);

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/auth/login/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mfaToken, code: mfaCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid or expired verification code.');
      }

      setAccessToken(data.access_token);
      setCurrentUser(data.user);
      await establishSharedSession(data.access_token, data.user?.organizationId);
      await routeAfterAuth(data.user, searchParams.get('returnUrl'));
    } catch (err: any) {
      setError(err.message === 'Failed to fetch' ? 'Unable to connect to server. Please try again.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Register (Student)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (confirmPassword && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = getApiUrl();
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        countryCode: countryCode.trim() || '+61',
        phone: phone.trim() || '0400000000',
        dateOfBirth: dateOfBirth || '2000-01-01',
        countryOfOrigin: countryOfOrigin || undefined,
        turnstileToken: turnstileToken || undefined,
      };

      const res = await fetch(`${apiUrl}/api/v1/auth/register/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        throw new Error(msg || 'Email already in use');
      }

      if (data.requiresEmailVerification) {
        switchMode('verify');
        setResendCooldown(60);
      } else if (data.access_token) {
        setAccessToken(data.access_token);
        if (data.user) {
          setCurrentUser(data.user);
        }
        await establishSharedSession(data.access_token, data.user?.organizationId);
        router.push(data.user ? getDashboardRouteForUser(data.user) : '/student');
      } else {
        switchMode('login');
      }
    } catch (err: any) {
      setError(err.message === 'Failed to fetch' ? 'Unable to create account. Please check connection.' : err.message);
      setTurnstileToken('');
      if (typeof window !== 'undefined' && window.turnstile) {
        window.turnstile.reset();
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Verify OTP
  const verifyOtp = useCallback(
    async (code: string, options: { manual?: boolean } = {}) => {
      const normalizedOtp = code.replace(/\D/g, '').slice(0, 6);
      if (!/^\d{6}$/.test(normalizedOtp)) {
        setError('Enter a valid 6-digit OTP code.');
        return;
      }

      if (verificationInFlightRef.current) return;
      if (!options.manual && lastVerificationAttemptRef.current === normalizedOtp) return;

      verificationInFlightRef.current = true;
      lastVerificationAttemptRef.current = normalizedOtp;
      setError('');
      setLoading(true);

      try {
        const apiUrl = getApiUrl();
        const res = await fetch(`${apiUrl}/api/v1/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), otp: normalizedOtp }),
        });

        const data = await res.json();
        if (!res.ok) {
          lastVerificationAttemptRef.current = null;
          setError(data.message || 'Invalid verification code');
          return;
        }

        setAccessToken(data.access_token);
        setCurrentUser(data.user);
        await establishSharedSession(data.access_token, data.user?.organizationId);
        await routeAfterAuth(data.user, searchParams.get('returnUrl'));
      } catch (err: any) {
        lastVerificationAttemptRef.current = null;
        setError(
          err.message === 'Failed to fetch'
            ? "We couldn't verify the code. Please check your connection and try again."
            : "We couldn't verify the code. Please try again."
        );
      } finally {
        verificationInFlightRef.current = false;
        setLoading(false);
      }
    },
    [email, router]
  );

  useEffect(() => {
    if (mode === 'verify' && /^\d{6}$/.test(otp)) {
      void verifyOtp(otp);
    }
  }, [mode, otp, verifyOtp]);

  const handleOtpChange = (value: string) => {
    const sanitizedOtp = value.replace(/\D/g, '').slice(0, 6);
    if (lastVerificationAttemptRef.current && sanitizedOtp !== lastVerificationAttemptRef.current) {
      lastVerificationAttemptRef.current = null;
    }
    setError('');
    setOtp(sanitizedOtp);
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyOtp(otp, { manual: true });
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to resend code.');
      }
      setResendCooldown(60);
      setSuccessMessage('A fresh verification code has been dispatched.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 4. Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to process password reset request.');
      }

      setSuccessMessage(data.message || 'If an account exists with this email, a reset code has been sent.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 overflow-x-hidden bg-white">
      {/* ========================================================================= */}
      {/* LEFT PANEL: Student / Customer Experience (50% Desktop)                  */}
      {/* ========================================================================= */}
      <div className="w-full min-h-screen lg:min-h-0 bg-white flex flex-col justify-between p-6 sm:p-10 lg:px-14 lg:py-10">
        {/* Top branding bar */}
        <div className="max-w-md w-full mx-auto flex flex-wrap items-center justify-between gap-3 mb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/assets/logo_navbar.png"
              alt="Jesmond"
              width={140}
              height={36}
              className="h-9 w-auto object-contain"
              priority
            />
            <span className="text-[11px] text-slate-500 font-semibold tracking-wider uppercase border-l border-slate-200 pl-3">
              Student &amp; Customer Portal
            </span>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Centralized Identity</span>
          </div>
        </div>

        <div className="max-w-md w-full mx-auto my-auto">
          <div>
            {/* Mode Switcher Tabs */}
            {mode !== 'verify' && (
              <div role="tablist" aria-label="Authentication modes" className="flex items-center p-1 bg-slate-100 rounded-xl max-w-xs mb-8">
                <button
                  role="tab"
                  id="tab-sign-in"
                  aria-selected={mode === 'login' || mode === 'forgot'}
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                    mode === 'login' || mode === 'forgot'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  role="tab"
                  id="tab-create-account"
                  aria-selected={mode === 'register'}
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Header Titles */}
            <div className="mb-6">
              {mode === 'login' && (
                <>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 mb-3">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    <span>Students & General Customers</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-outfit">
                    Sign in to Jesmond
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Access your student accommodation, bookings, dining orders, and services.
                  </p>
                </>
              )}

              {mode === 'register' && (
                <>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 mb-3">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    <span>New Student Registration</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-outfit">
                    Create your account
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Find accommodation, reserve appointments, and unlock verified student discounts.
                  </p>
                </>
              )}

              {mode === 'forgot' && (
                <>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-4 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to sign in</span>
                  </button>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-outfit">
                    Forgot your password?
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Enter your registered email address to receive a secure password reset code.
                  </p>
                </>
              )}

              {mode === 'verify' && (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-outfit">
                    Verify your email
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    We&apos;ve sent a 6-digit code to{' '}
                    <span className="font-semibold text-slate-900">{email}</span>
                  </p>
                </>
              )}
            </div>

            {/* Alerts */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                aria-live="polite"
                className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 flex items-start gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{successMessage}</div>
              </div>
            )}

            {/* MODE 1: LOGIN FORM */}
            {mode === 'login' && mfaToken && (
              <form onSubmit={handleMfaLogin} className="space-y-5">
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
                  <p className="font-semibold">Two-Factor Authentication Required</p>
                  <p className="mt-1 text-indigo-700">
                    Enter the 6-digit verification code from your authenticator app.
                  </p>
                </div>
                <div>
                  <label htmlFor="student-mfa-code" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="student-mfa-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-4 py-3 text-center tracking-widest text-lg font-mono font-bold rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Verifying Code...' : 'Verify & Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaToken(null);
                    setMfaCode('');
                    setError('');
                  }}
                  className="w-full py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Back to password sign in
                </button>
              </form>
            )}
            {mode === 'login' && !mfaToken && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label htmlFor="email-address" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      id="email-address"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.edu.au"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm"
                    />
                    <Mail className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Forgot your password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm"
                    />
                    <Lock className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl text-white font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* MODE 2: REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="first-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      First name
                    </label>
                    <input
                      id="first-name"
                      name="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="last-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Last name
                    </label>
                    <input
                      id="last-name"
                      name="lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email-address" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.edu.au"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Phone number
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-slate-600 text-xs font-semibold">
                        +61
                      </span>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0400 000 000"
                        className="w-full px-3.5 py-2.5 rounded-r-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="date-of-birth" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Date of birth
                    </label>
                    <input
                      id="date-of-birth"
                      name="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Confirm password
                    </label>
                    <input
                      id="confirm-password"
                      name="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <Turnstile
                    onVerify={handleTurnstileVerify}
                    onError={handleTurnstileError}
                    onExpire={handleTurnstileExpire}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl text-white font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* MODE 3: FORGOT PASSWORD */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Registered email
                  </label>
                  <div className="relative">
                    <input
                      id="forgot-email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.edu.au"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    />
                    <Mail className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl text-white font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending reset code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {successMessage && (
                  <div className="text-center pt-2">
                    <Link
                      href={`/reset-password?email=${encodeURIComponent(email)}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      <span>Proceed to enter OTP and reset password</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </form>
            )}

            {/* MODE 4: VERIFY OTP */}
            {mode === 'verify' && (
              <form onSubmit={handleVerifyOtpSubmit} className="space-y-6">
                <div>
                  <label htmlFor="otp" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2 text-center">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => handleOtpChange(e.target.value)}
                    placeholder="000000"
                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-indigo-200 text-center font-mono text-2xl tracking-[0.5em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
                  />
                  <p className="mt-2 text-xs text-center text-slate-500">
                    Code expires in 10 minutes.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl text-white font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying code...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify Email</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs sm:text-sm pt-2">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-slate-500 hover:text-slate-900 font-medium inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to login</span>
                  </button>
                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={handleResendOtp}
                    className="font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Bottom Switcher Footer */}
          {mode !== 'verify' && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-3 text-xs sm:text-sm">
              {mode === 'login' && (
                <p className="text-slate-500">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Sign up
                  </button>
                </p>
              )}
              {mode === 'register' && (
                <p className="text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Sign in
                  </button>
                </p>
              )}
              {mode === 'forgot' && (
                <p className="text-slate-500">
                  Remember your password?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Sign in
                  </button>
                </p>
              )}
              <div className="text-slate-400 flex items-center gap-1.5 text-xs shrink-0">
                <Lock className="w-3.5 h-3.5" />
                <span>256-bit TLS Encrypted</span>
              </div>
            </div>
          )}
        </div>

        {/* Left Panel Legal Footer */}
        <div className="max-w-md w-full mx-auto mt-8 pt-4 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span>© {new Date().getFullYear()} Jesmond. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-600">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-600">Terms of Service</Link>
            <Link href="/support" className="hover:text-slate-600">Support Center</Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT PANEL: Business Owners & Commercial Partners (50% Desktop)         */}
      {/* ========================================================================= */}
      <div className="w-full bg-gradient-to-br from-[#231409] via-[#3A2110] to-[#1A0E06] text-amber-50 p-6 sm:p-10 lg:px-14 lg:py-10 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-amber-900/50 relative overflow-hidden">
        {/* Subtle warm bronze/gold glow effects */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-lg w-full mx-auto my-auto relative z-10 flex flex-col justify-between">
          <div>
            {/* Top Enterprise Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-400/30 mb-6">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Commercial &amp; Partner Portal</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-outfit">
              Manage your enterprise on Jesmond
            </h2>

            <p className="mt-3 text-sm text-amber-100/80 leading-relaxed">
              A dedicated operational workspace built for property managers, accommodation providers, retail merchants, dining establishments, and service businesses.
            </p>

            {/* Feature Highlights Grid */}
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-amber-950/45 border border-amber-500/20 hover:bg-amber-900/40 hover:border-amber-400/35 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/25 flex items-center justify-center shrink-0 mt-0.5 text-amber-300">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Property &amp; Accommodation Hosting</h3>
                  <p className="text-xs text-amber-100/70 mt-0.5">
                    Room listings, student leases, tenancy records, maintenance tickets, and occupancy tracking.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-amber-950/45 border border-amber-500/20 hover:bg-amber-900/40 hover:border-amber-400/35 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-orange-500/20 border border-orange-400/25 flex items-center justify-center shrink-0 mt-0.5 text-orange-300">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Retail POS &amp; Live Inventory</h3>
                  <p className="text-xs text-amber-100/70 mt-0.5">
                    Integrated barcode scanning, automated stock sync, terminal dispatch, and customer receipts.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-amber-950/45 border border-amber-500/20 hover:bg-amber-900/40 hover:border-amber-400/35 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-yellow-500/20 border border-yellow-400/25 flex items-center justify-center shrink-0 mt-0.5 text-yellow-300">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Food &amp; Dining Operations</h3>
                  <p className="text-xs text-amber-100/70 mt-0.5">
                    Live kitchen display (KDS), table management, takeaway orders, and menu configuration.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-amber-950/45 border border-amber-500/20 hover:bg-amber-900/40 hover:border-amber-400/35 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-amber-600/25 border border-amber-400/25 flex items-center justify-center shrink-0 mt-0.5 text-amber-200">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Appointments &amp; Bookings</h3>
                  <p className="text-xs text-amber-100/70 mt-0.5">
                    Staff schedules, appointment calendars, client communications, and booking confirmations.
                  </p>
                </div>
              </div>
            </div>

            {/* Subdomain Notice */}
            <div className="mt-6 p-3.5 rounded-xl bg-[#2C180B]/90 border border-amber-500/30 text-xs text-amber-100">
              <div className="flex items-center gap-2 font-semibold text-white mb-1">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Dedicated Business Subdomain</span>
              </div>
              <p className="text-amber-100/80">
                Operating at <span className="font-mono text-amber-200 bg-black/35 border border-amber-500/20 px-1.5 py-0.5 rounded">business.jesmond.com.au</span> with separate session boundaries and organization-based role controls.
              </p>
            </div>
          </div>

          {/* Bottom Business CTA */}
          <div className="mt-8 pt-6 border-t border-amber-900/60 relative z-10 space-y-3">
            <a
              href={businessPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-5 rounded-xl text-white font-semibold text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:via-orange-500 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#231409] focus:ring-amber-400 shadow-lg shadow-orange-950/50 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Continue as Business</span>
              <ExternalLink className="w-4 h-4 text-amber-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>

            <div className="text-center">
              <a
                href={`${businessPortalUrl}/register`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-200/80 hover:text-white font-medium transition-colors inline-flex items-center gap-1"
              >
                <span>New partner? Register your business</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentAuthSplitScreen(props: StudentAuthSplitScreenProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="animate-pulse text-sm text-slate-500">Loading Jesmond Authentication...</div>
        </div>
      }
    >
      <StudentAuthContent {...props} />
    </Suspense>
  );
}
