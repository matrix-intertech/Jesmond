"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import { getAccessToken, getCurrentUser, clearAuth, setCurrentUser, User } from '@/utils/auth';
import { handleApiError } from '@/utils/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // pathname retained only for potential future use, not used in auth effect dependencies

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      clearAuth();
      router.replace('/login');
      return;
    }

    const cachedUser = getCurrentUser();
    const authorize = (usr: User) => {
      const allowed = ['ADMIN', 'SUPER_ADMIN'];
      if (!allowed.includes(usr.role)) {
        // redirect to correct dashboard based on role
        if (usr.role === 'PROVIDER') router.replace('/portal');
        else if (usr.role === 'STUDENT') router.replace('/student');
        else router.replace('/');
        return;
      }
      setUser(usr);
      setIsAuthorized(true);
    };

    if (cachedUser) {
      authorize(cachedUser);
      return;
    }

    // No cached user – recover via /auth/me endpoint
    const fetchUser = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await handleApiError(res, () => {
          clearAuth();
          router.replace('/login');
        });
        if (status === 'ok') {
          const data = await res.json();
          setCurrentUser(data.user);
          authorize(data.user);
        } else if (status === 'unauthorized') {
          // onAuthError already handled redirect
        } else {
          // Non‑401 errors – keep loading state; optionally show an error UI later
        }
      } catch (e) {
        // Network or unexpected error – do not logout, stay in loading state
        console.error('Failed to recover user via /auth/me:', e);
      }
    };
    fetchUser();
  }, []);

  if (!isAuthorized) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading dashboard...</div>;
  }

  return (
    <DashboardShell role={user?.role as any}>
      {children}
    </DashboardShell>
  );
}
