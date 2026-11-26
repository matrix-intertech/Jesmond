"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import { restoreUserSession, clearAuth, subscribeToSharedSessionRevalidation, User, getDashboardRouteForUser } from '@/utils/auth';
import { logoutBusinessSession } from '@/utils/sso';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const initAuth = useCallback(async (forceRefresh = false) => {
    setError(null);
    if (forceRefresh) setIsRetrying(true);

    const result = await restoreUserSession({ forceRefresh });

    if (result.status === 'unauthorized') {
      clearAuth();
      router.replace('/login');
      return;
    }

    if (result.status === 'forbidden') {
      setError(result.error || 'Access to admin dashboard is restricted.');
      setIsRetrying(false);
      return;
    }

    if (result.status === 'ok' && result.user) {
      const allowed = ['ADMIN', 'SUPER_ADMIN'];
      if (!allowed.includes(result.user.role)) {
        router.replace(getDashboardRouteForUser(result.user));
        return;
      }
      setUser(result.user);
      setIsAuthorized(true);
      setIsRetrying(false);
      return;
    }

    setError(result.error || 'Unable to load admin account. Please try again.');
    setIsRetrying(false);
  }, [router]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    return subscribeToSharedSessionRevalidation({
      onAuthenticated: (refreshedUser) => {
        setUser(refreshedUser);
      },
      onUnauthorized: () => {
        clearAuth();
        router.replace('/login');
      },
      onForbidden: (msg) => {
        setError(msg);
        setIsAuthorized(false);
      },
    });
  }, [router]);

  if (!isAuthorized) {
    if (error) {
      return (
        <div className="min-h-screen bg-surface-muted flex flex-col items-center justify-center p-8">
          <div className="max-w-md w-full bg-surface-card p-6 rounded-xl border border-border shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">Admin Dashboard Error</h2>
            <p className="text-sm text-text-secondary mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => initAuth(true)}
                disabled={isRetrying}
                className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={16} className={`mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Connecting...' : 'Retry'}
              </button>
              <button
                type="button"
                onClick={() => { void logoutBusinessSession('/login'); }}
                className="inline-flex items-center justify-center px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-muted transition-colors"
              >
                <LogOut size={16} className="mr-2" />
                Return to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-surface-muted flex flex-col items-center justify-center p-8">
        <h1 className="text-xl font-semibold text-primary mb-2">Admin Portal</h1>
        <p className="text-sm text-text-secondary">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <DashboardShell role={user?.role as any} user={user}>
      {children}
    </DashboardShell>
  );
}
