// apps/web/components/layout/DashboardShell.tsx
"use client";

import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
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
    <div className="flex min-h-screen bg-surface-muted">
      {/* Sidebar */}
      <Sidebar role={effectiveRole as any} />
      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <Header />
        {/* Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
