// apps/web/components/layout/Header.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser, clearAuth } from "@/utils/auth";

/**
 * Dashboard top header.
 * - Displays the Jesmond logo/name on the left.
 * - Shows the logged‑in user’s name, email and a logout button on the right.
 * - Uses Tailwind utility classes for a premium dark header that adapts to mobile.
 * - Relies solely on the existing inline SVG icons (the logout icon) and the auth utilities.
 */
export default function Header({ role }: { role: string }) {
  const router = useRouter();
  const user = getCurrentUser?.();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between bg-slate-900 text-white px-4 lg:px-8 h-16 shadow-md">
      {/* Logo / brand */}
      <Link href="/" className="text-2xl font-outfit font-medium">
        Jesmond
      </Link>

      {/* User info and logout */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col text-right">
          <span className="font-medium">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="text-sm text-slate-300">{user?.email}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-slate-200 hover:text-white"
          aria-label="Logout"
        >
          {/* Inline SVG for logout – same icon used in Sidebar */}
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
}
