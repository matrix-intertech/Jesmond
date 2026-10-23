"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import ProfileCompletionBanner from '@/components/ui/ProfileCompletionBanner';
import { getAccessToken, getCurrentUser, clearAuth, setCurrentUser, User } from '@/utils/auth';
import { handleApiError } from '@/utils/api';

export default function StudentLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
          // non‑401 errors
        }
      } catch (e) {
        console.error('Failed to recover user via /auth/me:', e);
      }
    };
    fetchUser();
  }, []);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-surface-muted flex flex-col items-center justify-center p-8">
        <h1 className="text-xl font-semibold text-primary mb-2">Student Portal</h1>
        <p className="text-sm text-text-secondary">Loading student account...</p>
      </div>
    );
  }

  return (
    <DashboardShell role={user?.role as any}>
      <ProfileCompletionBanner />
      {children}
    </DashboardShell>
  );
}
