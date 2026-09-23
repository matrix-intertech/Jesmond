"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Boxes,
  Building2,
  ClipboardList,
  Home,
  MessageCircle,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Store,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { getCurrentUser, type User } from "@/utils/auth";

type UserRole = "ADMIN" | "SUPER_ADMIN" | "ORG_STAFF" | "STUDENT";

interface MobileBottomNavProps {
  role?: UserRole;
}

type BottomNavIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type BottomNavItem = {
  href: string;
  label: string;
  icon: BottomNavIcon;
  isActive: (pathname: string, hash: string) => boolean;
  requiredPermissions?: string[];
};

const exact = (href: string) => (pathname: string) => pathname === href;
const section = (href: string) => (pathname: string) => pathname === href || pathname.startsWith(`${href}/`);

const homeItem: BottomNavItem = {
  href: "/",
  label: "Home",
  icon: Home,
  isActive: exact("/"),
};

const publicItems: BottomNavItem[] = [
  homeItem,
  {
    href: "/search",
    label: "Search",
    icon: Search,
    isActive: exact("/search"),
  },
  {
    href: "/retail",
    label: "Retail",
    icon: Store,
    isActive: section("/retail"),
  },
  {
    href: "/providers",
    label: "Providers",
    icon: Building2,
    isActive: section("/providers"),
  },
  {
    href: "/guide",
    label: "Guide",
    icon: BookOpen,
    isActive: section("/guide"),
  },
];

const studentItems: BottomNavItem[] = [
  homeItem,
  {
    href: "/search",
    label: "Search",
    icon: Search,
    isActive: exact("/search"),
  },
  {
    href: "/messages",
    label: "Chat",
    icon: MessageCircle,
    isActive: section("/messages"),
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
    isActive: section("/settings"),
  },
];

const providerItems: BottomNavItem[] = [
  homeItem,
  {
    href: "/portal/properties",
    label: "Properties",
    icon: Building2,
    isActive: section("/portal/properties"),
  },
  {
    href: "/portal/chats",
    label: "Chat",
    icon: MessageCircle,
    isActive: section("/portal/chats"),
  },
  {
    href: "/portal/applications",
    label: "Activity",
    icon: ClipboardList,
    isActive: section("/portal/applications"),
  },
  {
    href: "/portal/settings",
    label: "Settings",
    icon: Settings,
    isActive: section("/portal/settings"),
  },
];

const retailItems: BottomNavItem[] = [
  homeItem,
  {
    href: "/portal/retail/catalog",
    label: "Catalog",
    icon: Package,
    isActive: section("/portal/retail/catalog"),
  },
  {
    href: "/portal/retail/inventory",
    label: "Inventory",
    icon: Boxes,
    isActive: section("/portal/retail/inventory"),
  },
  {
    href: "/portal/retail/orders",
    label: "Orders",
    icon: ShoppingCart,
    isActive: section("/portal/retail/orders"),
    requiredPermissions: ["ORDERS_VIEW"],
  },
  {
    href: "/portal/retail/settings",
    label: "Settings",
    icon: Settings,
    isActive: section("/portal/retail/settings"),
    requiredPermissions: ["RETAIL_SETTINGS_VIEW"],
  },
];

const adminItems: BottomNavItem[] = [
  homeItem,
  {
    href: "/admin/properties",
    label: "Properties",
    icon: Building2,
    isActive: section("/admin/properties"),
  },
  {
    href: "/admin/applications",
    label: "Activity",
    icon: ClipboardList,
    isActive: section("/admin/applications"),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    isActive: section("/admin/settings"),
  },
];

const hasPermission = (user: User | null, item: BottomNavItem) => {
  if (!item.requiredPermissions?.length) return true;
  if (user?.orgRole === "ADMIN") return true;
  const permissions = user?.permissions || [];
  return permissions.includes("*") || item.requiredPermissions.some((permission) => permissions.includes(permission));
};

function getItemsForUser(role: UserRole | undefined, user: User | null) {
  if (!role) return publicItems;
  if (role === "STUDENT") return studentItems;
  if (role === "ADMIN" || role === "SUPER_ADMIN") return adminItems;

  if (role === "ORG_STAFF") {
    const orgType = user?.orgType || "PROVIDER";
    if (orgType === "RETAIL") return retailItems.filter((item) => hasPermission(user, item));
    return providerItems;
  }

  return publicItems;
}

export default function MobileBottomNav({ role }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const effectiveRole = (user?.role || role) as UserRole | undefined;
  const items = useMemo(() => getItemsForUser(effectiveRole, user), [effectiveRole, user]);

  if (!items.length) return null;

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="student-mobile-bottom-nav fixed inset-x-0 bottom-0 z-[60] w-screen border-t border-slate-200/80 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
    >
      <ul className={`mx-auto grid max-w-md gap-1 ${items.length === 4 ? "grid-cols-4" : "grid-cols-5"}`}>
        {items.map((item) => {
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
