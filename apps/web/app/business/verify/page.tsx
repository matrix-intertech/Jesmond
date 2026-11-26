'use client';
import { getApiUrl } from '@/utils/api';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { setAccessToken, setCurrentUser, establishSharedSession } from '@/utils/auth';
import { checkBusinessAccess, resolveBusinessAuthDestination } from '@/utils/sso';
import { ShieldCheck, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

function BusinessVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const qEmail = searchParams.get('email');
    if (qEmail) setEmail(qEmail);
  }, [searchParams]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!otp.trim()) {
      setError('Please enter the verification code sent to your email.');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification failed. Please check the code.');
      }

      if (data.user) {
        setCurrentUser(data.user);
      }
      if (data.access_token) {
        const ssoRes = await establishSharedSession(data.access_token, data.user?.organizationId);
        if (!ssoRes.ok) {
          throw new Error(ssoRes.message || 'Unable to establish shared portal session. Please try again.');
        }
        setAccessToken(data.access_token, data.user?.role);
      }

      // Check if user has active business access
      const accessStatus = await checkBusinessAccess();
      const resolution = resolveBusinessAuthDestination(data.user, accessStatus);
      if (resolution.action === 'redirect') {
        router.push(resolution.destination);
      } else if (resolution.action === 'select_organization') {
        router.push('/business/login');
      } else if (resolution.action === 'onboarding') {
        router.push('/business/onboarding');
      } else {
        throw new Error(resolution.message);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setError('');
    setMessage('');
    setResending(true);

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to resend code.');
      }

      setMessage('A fresh verification code has been dispatched to your email.');
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-md mx-auto w-full">
      <div className="bg-slate-950/90 border border-slate-800 p-8 sm:p-10 rounded-2xl shadow-2xl backdrop-blur-xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand-purple/20 border border-brand-purple/30 text-brand-purple flex items-center justify-center mx-auto mb-4">
          <Mail className="w-6 h-6" />
        </div>

        <h1 className="text-2xl font-bold text-white font-outfit">Verify Business Account</h1>
        <p className="text-xs text-slate-400 mt-2">
          We sent a 6-digit confirmation code to{' '}
          <span className="font-semibold text-slate-200">{email || 'your email'}</span>.
        </p>

        {error && (
          <div
            role="alert"
            className="my-4 p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="my-4 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="mt-6 space-y-5 text-left">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 text-center">
              Enter 6-Digit Code
            </label>
            <input
              type="text"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full py-3 text-center tracking-widest text-xl font-mono font-bold rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-purple"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-purple to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Confirming Code...</span>
              </>
            ) : (
              <>
                <span>Complete Verification</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Didn&apos;t receive code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resending}
            className="text-brand-purple hover:text-purple-300 font-semibold disabled:opacity-50 transition"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BusinessVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <BusinessVerifyContent />
    </Suspense>
  );
}
