// apps/web/components/layout/Sidebar.tsx
"use client";
import { ReactNode } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuth, getCurrentUser, User } from '@/utils/auth';
import { useState, useEffect } from 'react';

/**
 * Sidebar navigation for the dashboard.
 * Uses the existing inline SVG icons from the project to avoid adding new dependencies.
 * Role‑based navigation items are defined in a simple config object.
 */
interface NavItem {
  href: string;
  label: string;
  // Inline SVG markup for the icon (lightweight, no external library).
  icon: ReactNode;
  roles: ('SUPER_ADMIN' | 'ADMIN' | 'ORG_STAFF' | 'STUDENT')[];
  orgTypes?: string[];
}

const navConfig: NavItem[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h18" />
        <path d="M3 6h18" />
        <path d="M3 18h18" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    href: '/admin/properties',
    label: 'Properties',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    href: '/admin/applications',
    label: 'Applications',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3" />
        <path d="M22 4l-10 10" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  // Provider navigation
  {
    href: '/portal',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h18" />
        <path d="M3 6h18" />
        <path d="M3 18h18" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
  },
  {
    href: '/portal/properties',
    label: 'My Properties',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['PROVIDER'],
  },
  {
    href: '/portal/applications',
    label: 'Applications',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3" />
        <path d="M22 4l-10 10" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['PROVIDER'],
  },
  {
    href: '/portal/settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['PROVIDER'],
  },
  {
    href: '/portal/retail',
    label: 'Retail Overview',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['RETAIL'],
  },
  {
    href: '/portal/retail/business',
    label: 'Retail Business',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['RETAIL'],
  },
  {
    href: '/portal/retail/terminals',
    label: 'Retail Terminals',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" />
        <line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" />
        <line x1="20" y1="14" x2="23" y2="14" />
        <line x1="1" y1="9" x2="4" y2="9" />
        <line x1="1" y1="14" x2="4" y2="14" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['RETAIL'],
  },
  {
    href: '/portal/retail/customers',
    label: 'Retail Customers',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['RETAIL'],
  },
  {
    href: '/portal/retail/catalog',
    label: 'Retail Catalog',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['RETAIL'],
  },
  {
    href: '/portal/retail/inventory',
    label: 'Inventory',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['RETAIL'],
  },
  {
    href: '/portal/retail/orders',
    label: 'Sales History',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['RETAIL'],
  },
  {
    href: '/portal/retail/pos',
    label: 'POS',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    roles: ['ORG_STAFF'],
    orgTypes: ['RETAIL'],
  },
  // Student navigation
  {
    href: '/student',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h18" />
        <path d="M3 6h18" />
        <path d="M3 18h18" />
      </svg>
    ),
    roles: ['STUDENT'],
  },
  {
    href: '/search',
    label: 'Search Accommodation',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    roles: ['STUDENT'],
  },
  {
    href: '/student/saved',
    label: 'Saved',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
    ),
    roles: ['STUDENT'],
  },
  {
    href: '/student/applications',
    label: 'My Applications',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h6" />
        <path d="M9 16h6" />
        <path d="M9 8h6" />
        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
      </svg>
    ),
    roles: ['STUDENT'],
  },
  {
    href: '/student/settings',
    label: 'Profile',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
        <path d="M6 20v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      </svg>
    ),
    roles: ['STUDENT'],
  },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const visibleItems = navConfig.filter((i) => {
    if (!i.roles.includes(role as any)) return false;
    if (i.orgTypes) {
      // Legacy users might not have orgType in local storage yet. Default to PROVIDER.
      const userOrgType = user?.orgType || 'PROVIDER';
      if (!i.orgTypes.includes(userOrgType)) return false;
    }
    return true;
  });

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="lg:hidden p-2 m-2 rounded-md bg-slate-200 hover:bg-slate-300"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        {/* Simple menu icon */}
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Sidebar – hidden on mobile unless open */}
      <nav
        className={`bg-white border-r border-slate-200/60 w-72 flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out lg:translate-x-0 ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-30`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <span className="text-2xl font-bold text-brand-navy font-outfit tracking-tight">Jesmond</span>
          <button className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition" onClick={() => setOpen(false)} aria-label="Close navigation">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto px-4 space-y-1 mt-2">
          {visibleItems.map((item) => {
            const isActive = pathname?.startsWith(item.href) && (item.href === pathname || item.href !== '/admin' && item.href !== '/portal' && item.href !== '/student' || pathname === item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-brand-orange/10 text-brand-orange font-semibold shadow-sm' : 'text-brand-navy/90 hover:bg-surface-muted hover:text-brand-navy'}`}
                >
                  <div className={`${isActive ? 'text-brand-orange' : 'text-gray-600'}`}>
                    {item.icon}
                  </div>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="p-4 mx-4 mb-4 mt-auto bg-surface-muted rounded-2xl border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-orange to-orange-500 flex items-center justify-center text-sm font-bold text-white shadow-sm">
              {user?.firstName?.[0] ?? 'U'}
            </div>
            <div className="flex-1 text-sm overflow-hidden">
              <div className="font-semibold text-brand-navy truncate">{user?.firstName} {user?.lastName}</div>
              <div className="text-gray-500 text-xs truncate">{user?.email}</div>
            </div>
          </div>
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-2 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-slate-100 transition-all font-medium text-sm shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Visit Site
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all font-medium text-sm shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </nav>
    </>
  );
}
