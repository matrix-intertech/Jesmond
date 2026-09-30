// apps/web/components/layout/Header.tsx
"use client";


import { NotificationDropdown } from '../notifications/NotificationDropdown';

/**
 * Dashboard top header.
 * - Displays the Jesmond logo/name on the left.
 * - Shows the logged‑in user’s name, email and a logout button on the right.
 * - Uses Tailwind utility classes for a premium dark header that adapts to mobile.
 * - Relies solely on the existing inline SVG icons (the logout icon) and the auth utilities.
 */
export default function Header() {
  return (
    <header className="flex items-center justify-end bg-surface/80 backdrop-blur-md border-b border-border-strong/60 px-6 h-[76px] sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <NotificationDropdown />
      </div>
    </header>
  );
}
