'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { setAccessToken, setCurrentUser } from '@/utils/auth';
import { Suspense } from 'react';
import Turnstile from '@/components/ui/Turnstile';

function RegisterForm() {
  const [accountType, setAccountType] = useState<'student' | 'host' | 'retailer'>('student');
  
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+61');
  const [phone, setPhone] = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationType, setOrganizationType] = useState('PROVIDER');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);
  const handleTurnstileError = useCallback(() => { setTurnstileToken(''); setError('Security verification failed.'); }, []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(''), []);

  useEffect(() => {
    if (searchParams.get('verify') === 'true' && searchParams.get('email')) {
      setEmail(searchParams.get('email') || '');
      setShowOtp(true);
    }
  }, [searchParams]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required.');
      return;
    }
    if (!countryCode.trim()) {
      setError('Country code is required.');
      return;
    }
    if (!dateOfBirth.trim()) {
      setError('Date of birth is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (accountType === 'retailer' && !organizationName.trim()) {
      setError('Retail store name is required.');
      return;
    }
    
    // Split name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ' ';


    setLoading(true);

    try {
      const endpoint = accountType === 'student'
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/register/student`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/register`;

      const payload = accountType === 'student'
        ? { firstName, lastName, email: email.trim(), password, countryCode, phone: phone.trim(), ethnicity: ethnicity || undefined, dateOfBirth, turnstileToken }
        : { firstName, lastName, email: email.trim(), password, countryCode, phone: phone.trim(), ethnicity: ethnicity || undefined, dateOfBirth, organizationName: accountType === 'retailer' ? organizationName.trim() : (firstName + ' ' + lastName), organizationType, turnstileToken };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        throw new Error(msg || 'Registration failed.');
      }

      if (data.requiresEmailVerification) {
        setShowOtp(true);
        setResendCooldown(60);
      } else if (data.access_token) {
        // Fallback if verification disabled
        setAccessToken(data.access_token);
        if (data.user) {
          setCurrentUser(data.user);
        }
        router.push(accountType === 'student' ? '/student' : '/portal');
      } else {
        router.push('/login');
      }
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('Unable to create account. Please try again later.');
      } else {
        setError(err.message);
      }
      setTurnstileToken('');
      if (window.turnstile) window.turnstile.reset();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification failed');
      }
      setAccessToken(data.access_token);
      setCurrentUser(data.user);
      router.push(data.user.role === 'STUDENT' ? '/student' : '/portal');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to resend code');
      }
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (showOtp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-muted py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100 text-center">
          <div>
            <h2 className="mt-2 text-center text-3xl font-extrabold text-brand-navy font-outfit">Verify your email</h2>
            <p className="mt-2 text-sm text-gray-500">
              We've sent a 6-digit code to <span className="font-semibold text-brand-navy">{email}</span>
            </p>
          </div>
          <form className="space-y-6" onSubmit={handleVerifyOtp}>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="otp" className="sr-only">Verification Code</label>
              <input
                id="otp"
                name="otp"
                type="text"
                maxLength={6}
                required
                className="appearance-none rounded relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-brand-navy focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-lg text-center tracking-widest font-mono"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>
            </div>
            <div className="text-sm">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                className="text-brand-orange hover:text-indigo-500 disabled:text-gray-400 font-medium"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-brand-navy font-outfit">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-orange hover:text-indigo-500 font-medium">
              Sign in
            </Link>
          </p>
        </div>

        
        {/* Account Type Selector */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => { setAccountType('student'); setOrganizationType('PROVIDER'); }}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              accountType === 'student'
                ? 'bg-brand-orange text-white'
                : 'bg-white text-gray-600 hover:bg-surface-muted'
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => { setAccountType('host'); setOrganizationType('PROVIDER'); }}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              accountType === 'host'
                ? 'bg-brand-orange text-white'
                : 'bg-white text-gray-600 hover:bg-surface-muted'
            }`}
          >
            Host
          </button>
          <button
            type="button"
            onClick={() => { setAccountType('retailer'); setOrganizationType('RETAIL'); }}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              accountType === 'retailer'
                ? 'bg-brand-orange text-white'
                : 'bg-white text-gray-600 hover:bg-surface-muted'
            }`}
          >
            Retailer
          </button>
        </div>
<form className="space-y-5" onSubmit={handleRegister}>
          {error && (
            <div className="bg-red-50 text-red-600 text-sm text-center p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            {accountType === 'retailer' && (
              <div>
                <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Retail Store Name
                </label>
                <input
                  id="org-name"
                  name="organizationName"
                  type="text"
                  required
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                  placeholder="Retail Store Name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex space-x-2">
              <div className="w-1/3">
                <label htmlFor="country-code" className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <select
                  id="country-code"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="block w-full rounded border border-gray-300 bg-white px-3 py-2 focus:border-brand-orange focus:outline-none sm:text-sm"
                >
                  <option value="+61">+61</option>
                  <option value="+1">+1</option>
                  <option value="+44">+44</option>
                  <option value="+91">+91</option>
                  <option value="+65">+65</option>
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                  placeholder="4XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ethnicity" className="block text-sm font-medium text-gray-700 mb-1">
                  Ethnicity (Optional)
                </label>
                <select
                  id="ethnicity"
                  value={ethnicity}
                  onChange={(e) => setEthnicity(e.target.value)}
                  className="block w-full rounded border border-gray-300 bg-white px-3 py-2 focus:border-brand-orange focus:outline-none sm:text-sm"
                >
                  <option value="">Select...</option>
                  <option value="Asian">Asian</option>
                  <option value="Black">Black</option>
                  <option value="Hispanic">Hispanic</option>
                  <option value="White">White</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  id="dob"
                  name="dob"
                  type="date"
                  required
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-brand-orange sm:text-sm"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

          <Turnstile
            onVerify={handleTurnstileVerify}
            onError={handleTurnstileError}
            onExpire={handleTurnstileExpire}
          />

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
