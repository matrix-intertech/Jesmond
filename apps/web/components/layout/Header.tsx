// apps/web/components/layout/Header.tsx
"use client";


/**
 * Dashboard top header.
 * - Displays the Jesmond logo/name on the left.
 * - Shows the logged‑in user’s name, email and a logout button on the right.
 * - Uses Tailwind utility classes for a premium dark header that adapts to mobile.
 * - Relies solely on the existing inline SVG icons (the logout icon) and the auth utilities.
 */
export default function Header() {
  return (
    <header className="flex items-center justify-end bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 h-[76px] sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button
          className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-surface-muted rounded-full transition"
          aria-label="Notifications"
        >
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-orange/100 rounded-full ring-2 ring-white"></span>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </button>
      </div>
    </header>
  );
}
