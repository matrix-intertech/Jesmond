'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setAccessToken, setCurrentUser } from '@/utils/auth';

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<'student' | 'provider'>('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationType, setOrganizationType] = useState('PROVIDER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
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
    if (accountType === 'provider' && !organizationName.trim()) {
      setError('Organisation name is required.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = accountType === 'student'
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/register/student`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/register`;

      const payload = accountType === 'student'
        ? { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password }
        : { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, organizationName: organizationName.trim(), organizationType };

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

      if (data.access_token) {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900 font-outfit">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Sign in
            </Link>
          </p>
        </div>

        {/* Account Type Selector */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setAccountType('student')}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              accountType === 'student'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            I&apos;m a Student
          </button>
          <button
            type="button"
            onClick={() => setAccountType('provider')}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              accountType === 'provider'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            I&apos;m a Provider
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleRegister}>
          {error && (
            <div className="bg-red-50 text-red-600 text-sm text-center p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-1">
                First name
              </label>
              <input
                id="first-name"
                name="firstName"
                type="text"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-1">
                Last name
              </label>
              <input
                id="last-name"
                name="lastName"
                type="text"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              required
              className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {accountType === 'provider' && (
            <>
              <div>
                <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Organisation name
                </label>
                <input
                  id="org-name"
                  name="organizationName"
                  type="text"
                  required
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Organisation name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="org-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Organisation type
                </label>
                <select
                  id="org-type"
                  name="organizationType"
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={organizationType}
                  onChange={(e) => setOrganizationType(e.target.value)}
                >
                  <option value="PROVIDER">Accommodation Provider</option>
                  <option value="UNIVERSITY">University</option>
                  <option value="AGENCY">Agency</option>
                </select>
              </div>
            </>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
