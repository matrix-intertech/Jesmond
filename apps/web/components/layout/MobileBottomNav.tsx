"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, MessageCircle, Search, Settings } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";

interface MobileBottomNavProps {
  role: "ADMIN" | "SUPER_ADMIN" | "ORG_STAFF" | "STUDENT";
}

interface BottomNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  isActive: (pathname: string, hash: string) => boolean;
}

const studentItems: BottomNavItem[] = [
  {
    href: "/student",
    label: "Home",
    icon: Home,
    isActive: (pathname, hash) => pathname === "/student" && hash !== "#applications",
  },
  {
    href: "/search",
    label: "Search",
    icon: Search,
    isActive: (pathname) => pathname === "/search",
  },
  {
    href: "/messages",
    label: "Chat",
    icon: MessageCircle,
    isActive: (pathname) => pathname === "/messages" || pathname.startsWith("/messages/"),
  },
  {
    href: "/student#applications",
    label: "Activity",
    icon: ClipboardList,
    isActive: (pathname, hash) => pathname === "/student" && hash === "#applications",
  },
  {
    href: "/settings/profile",
    label: "Settings",
    icon: Settings,
    isActive: (pathname) => pathname.startsWith("/settings/"),
  },
];

export default function MobileBottomNav({ role }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  if (role !== "STUDENT") return null;

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {studentItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname, hash);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-brand-orange/10 text-brand-orange"
                    : "text-slate-500 hover:bg-slate-50 hover:text-brand-navy"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="max-w-full truncate leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
