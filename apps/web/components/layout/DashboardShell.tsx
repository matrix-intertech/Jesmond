// apps/web/components/layout/DashboardShell.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { QuickstartProvider } from '../quickstart/QuickstartProvider';
import { SubscriptionRequiredModal } from '../subscriptions/SubscriptionRequiredModal';
import type { ReactNode } from 'react';
import { getCurrentUser, User } from '@/utils/auth';

interface DashboardShellProps {
  role: 'ADMIN' | 'SUPER_ADMIN' | 'ORG_STAFF' | 'STUDENT';
  user?: User | null;
  children: ReactNode;
}

/**
 * Provides the consistent dashboard shell with a sticky sidebar, top header, and main content area.
 * Uses server‑side rendering where possible; the component itself is a client component because it
 * needs to read the user role (which may come from a cookie) at runtime.
 */
export default function DashboardShell({ role, user: propUser, children }: DashboardShellProps) {
  const [user, setUser] = useState<User | null>(propUser ?? null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setUser(propUser ?? getCurrentUser());
  }, [propUser]);

  const effectiveUser = user ?? propUser ?? (typeof window !== 'undefined' ? getCurrentUser() : null);
  const effectiveRole = (effectiveUser?.role as any) ?? role;

  return (
    <QuickstartProvider user={effectiveUser}>
      <div className="flex min-h-dvh min-w-0 bg-surface-muted">
        {/* Sidebar */}
        <Sidebar
          role={effectiveRole as any}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <Header
            user={effectiveUser}
            mobileNavOpen={mobileNavOpen}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          {/* Content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:p-8">{children}</main>
        </div>
      </div>
      <SubscriptionRequiredModal />
    </QuickstartProvider>
  );
}
