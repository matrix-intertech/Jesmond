// apps/web/components/layout/DashboardShell.tsx
"use client";

import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileBottomNav from './MobileBottomNav';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/utils/auth';

interface DashboardShellProps {
  role: 'ADMIN' | 'SUPER_ADMIN' | 'ORG_STAFF' | 'STUDENT';
  children: ReactNode;
}

/**
 * Provides the consistent dashboard shell with a sticky sidebar, top header, and main content area.
 * Uses server‑side rendering where possible; the component itself is a client component because it
 * needs to read the user role (which may come from a cookie) at runtime.
 */
export default function DashboardShell({ role, children }: DashboardShellProps) {
  // Role may be derived from auth utils; fallback to passed prop for simplicity.
  const user = getCurrentUser?.();
  const effectiveRole = user?.role ?? role;

  return (
    <div className="flex min-h-screen min-w-0 bg-surface-muted">
      {/* Sidebar */}
      <Sidebar role={effectiveRole as any} />
      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <Header />
        {/* Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-16 sm:px-6 sm:py-6 lg:p-8">{children}</main>
        <MobileBottomNav role={effectiveRole as any} />
      </div>
    </div>
  );
}
