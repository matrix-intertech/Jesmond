"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';


import DashboardShell from '@/components/layout/DashboardShell';
import { getAccessToken, getCurrentUser, clearAuth, setCurrentUser, User } from '@/utils/auth';
import { handleApiError } from '@/utils/api';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // pathname retained for possible future use; not used in auth effect deps
  const pathname = usePathname();
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
      if (usr.role !== 'STUDENT') {
        // redirect to appropriate dashboard based on role
        if (usr.role === 'ADMIN' || usr.role === 'SUPER_ADMIN') router.replace('/admin');
        else if (usr.role === 'ORG_STAFF') router.replace('/portal');
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
          // already handled
        } else {
          // non‑401 errors – stay loading
        }
      } catch (e) {
        console.error('Failed to recover user via /auth/me:', e);
      }
    };
    fetchUser();
  }, []);

  if (!isAuthorized) {
    return <div className="min-h-screen bg-surface-muted flex items-center justify-center">Loading dashboard...</div>;
  }

  return (
    <DashboardShell role={user?.role as any}>
      {children}
    </DashboardShell>
  );
}
