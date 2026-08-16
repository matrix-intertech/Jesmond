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

  const visibleItems = navConfig.filter((i) => i.roles.includes(role as any));

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
        className={`bg-white border-r border-slate-200/60 w-72 flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out lg:translate-x-0 ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} fixed lg:static inset-y-0 left-0 z-30`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <span className="text-2xl font-bold text-slate-900 font-outfit tracking-tight">Jesmond</span>
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm' : 'text-gray-800 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  <div className={`${isActive ? 'text-indigo-600' : 'text-gray-600'}`}>
                    {item.icon}
                  </div>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="p-4 mx-4 mb-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
              {user?.firstName?.[0] ?? 'U'}
            </div>
            <div className="flex-1 text-sm overflow-hidden">
              <div className="font-semibold text-slate-900 truncate">{user?.firstName} {user?.lastName}</div>
              <div className="text-gray-500 text-xs truncate">{user?.email}</div>
            </div>
          </div>
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
