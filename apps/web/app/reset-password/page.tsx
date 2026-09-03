'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error resending OTP');
      setCooldown(60);
      setStatus('idle');
      setMessage('New OTP sent.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match');
      return;
    }
    
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'An error occurred.');
      }
      
      setStatus('success');
      setMessage(data.message || 'Password reset successfully.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-brand-navy font-outfit">
            Reset Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Enter the 6-digit OTP sent to your email and choose a new password.
          </p>
        </div>
        
        {status === 'success' ? (
          <div className="mt-8 space-y-6">
            <div className="bg-green-50 text-green-700 p-4 rounded-md border border-green-200 text-center">
              {message}
            </div>
            <div className="text-center">
              <Link href="/login" className="text-brand-orange hover:text-indigo-500 font-medium">
                Go to Login &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {status === 'error' && (
              <div className="bg-red-50 text-red-600 text-sm text-center p-3 rounded-lg border border-red-200">
                {message}
              </div>
            )}
            
            {message && status === 'idle' && (
              <div className="bg-blue-50 text-blue-600 text-sm text-center p-3 rounded-lg border border-blue-200">
                {message}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  readOnly={!!initialEmail}
                  className="mt-1 appearance-none rounded block w-full px-3 py-2 border border-gray-300 bg-gray-50 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">6-Digit OTP</label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  inputMode="numeric"
                  className="mt-1 appearance-none rounded block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  required
                  minLength={8}
                  className="mt-1 appearance-none rounded block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  className="mt-1 appearance-none rounded block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
            
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0}
                className="text-sm font-medium text-brand-navy hover:text-brand-orange disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-muted">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
