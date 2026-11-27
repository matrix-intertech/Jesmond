"use client";

import { canUseBusinessCapability } from "@/utils/capabilities";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
 BookOpen,
 Boxes,
 Building2,
 Calendar,
 ClipboardList,
 Clock,
 Home,
 MessageCircle,
 Package,
 Search,
 Settings,
 ShoppingCart,
 Store,
 Users,
 Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { getCurrentUser, isBusinessHost, type User } from "@/utils/auth";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";

type UserRole = "ADMIN" | "SUPER_ADMIN" | "ORG_STAFF" | "STUDENT";

interface MobileBottomNavProps {
 role?: UserRole;
 isBusinessTheme?: boolean;
}

type BottomNavIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type BottomNavItem = {
 href: string;
 label: string;
 icon: BottomNavIcon;
 isActive: (pathname: string, hash: string) => boolean;
 requiredPermissions?: string[];
  requiredCapabilities?: import("@/utils/capabilities").BusinessCapability[];
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
 href: "/businesses",
 label: "Businesses",
 icon: Store,
 isActive: section("/businesses"),
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
 href: "/portal/leads",
 label: "Leads",
 icon: Users,
 isActive: section("/portal/leads"),
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
 requiredCapabilities: ["INVENTORY"],
    href: "/portal/retail/inventory",
 label: "Inventory",
 icon: Boxes,
 isActive: section("/portal/retail/inventory"),
 },
 {
 requiredCapabilities: ["ORDERS"],
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

const hasCapability = (user: User | null, item: BottomNavItem) => {
  if (!item.requiredCapabilities?.length) return true;
  return item.requiredCapabilities.every((cap: any) => canUseBusinessCapability(user?.businessCategory, cap));
};

const appointmentsItems: BottomNavItem[] = [
 {
 href: "/portal/business/appointments",
 label: "Bookings",
 icon: Calendar,
 isActive: (p) =>
 p === "/" ||
 p === "/services" ||
 p === "/mechanics" ||
 p === "/rentals" ||
 p.startsWith("/portal/business/appointments"),
 },
 {
 href: "/portal/business/services",
 label: "Services",
 icon: Wrench,
 isActive: section("/portal/business/services"),
 },
 {
 href: "/portal/business/availability",
 label: "Schedule",
 icon: Clock,
 isActive: section("/portal/business/availability"),
 },
 {
 href: "/portal/business/customers",
 label: "Clients",
 icon: Users,
 isActive: section("/portal/business/customers"),
 },
 {
 href: "/portal/settings",
 label: "Settings",
 icon: Settings,
 isActive: section("/portal/settings"),
 },
];

function getItemsForUser(role: UserRole | undefined, user: User | null) {
 if (!role) return publicItems;
 if (role === "STUDENT") return studentItems;
 if (role === "ADMIN" || role === "SUPER_ADMIN") return adminItems;

 if (role === "ORG_STAFF") {
 const category = (user?.businessCategory || "").toUpperCase();
 if (category === "SERVICES" || category === "MECHANICS" || (category === "RENTALS" && user?.orgType !== "PROVIDER" && user?.orgType !== "AGENCY")) {
 return appointmentsItems;
 }
 const orgType = user?.orgType || "PROVIDER";
 if (orgType === "RETAIL") return retailItems.filter((item) => hasPermission(user, item) && hasCapability(user, item));
 return providerItems;
 }

 return publicItems;
}

export default function MobileBottomNav({ role, isBusinessTheme = false }: MobileBottomNavProps) {
 const pathname = usePathname();
 const [hash, setHash] = useState("");
 const [user, setUser] = useState<User | null>(null);
 const [isBizHost, setIsBizHost] = useState(isBusinessTheme);
 const unreadChatCount = useUnreadChatCount();

 useEffect(() => {
 const sync = () => {
 setUser(getCurrentUser());
 setIsBizHost(isBusinessTheme || isBusinessHost());
 };
 sync();
 window.addEventListener("storage", sync);
 return () => window.removeEventListener("storage", sync);
 }, [pathname, isBusinessTheme]);

 useEffect(() => {
 const syncHash = () => setHash(window.location.hash);
 syncHash();
 window.addEventListener("hashchange", syncHash);
 return () => window.removeEventListener("hashchange", syncHash);
 }, []);

 const effectiveRole = (user?.role || role) as UserRole | undefined;
 const items = useMemo(() => getItemsForUser(effectiveRole, user), [effectiveRole, user]);

 if (!items.length) return null;

 const useDarkTheme = isBizHost || effectiveRole === "ORG_STAFF";

 return (
 <nav
 aria-label="Primary mobile navigation"
 data-theme-variant={useDarkTheme ? "business-dark" : "customer-light"}
 className="student-mobile-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden"
 >
 <div
 className={`pointer-events-auto mx-auto w-full max-w-[430px] rounded-[28px] px-2 pb-2 pt-1.5 backdrop-blur-md transition-all duration-200 ${
 useDarkTheme
 ? "border border-[rgba(214,166,79,0.28)] bg-[#120D09]/95 shadow-[0_12px_32px_rgba(0,0,0,0.55),0_2px_10px_rgba(234,138,50,0.12)]"
 : "border border-slate-200/90 bg-white/95 shadow-[0_10px_30px_rgba(23,18,77,0.12),0_2px_8px_rgba(23,18,77,0.06)]"
 }`}
 >
 <ul
 className="grid items-end gap-0.5"
 style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
 >
 {items.map((item) => {
 const Icon = item.icon;
 const active = item.isActive(pathname, hash);

 return (
 <li key={item.href} className="min-w-0">
 <Link
 href={item.href}
 aria-current={active ? "page" : undefined}
 className={`group relative flex min-h-[52px] min-w-[44px] flex-col items-center justify-end gap-1 rounded-2xl px-1 pb-1 pt-1 text-[11px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent ${
 active
 ? useDarkTheme
 ? "font-bold text-[#F3D69A]"
 : "font-bold text-[#2F1AA8]"
 : useDarkTheme
 ? "font-medium text-[#C9B69C] hover:text-[#FFF9EF]"
 : "font-medium text-[#4B4666] hover:text-[#17124D]"
 }`}
 >
 <div
 className={`relative flex items-center justify-center transition-all duration-300 ${
 active
 ? useDarkTheme
 ? "-translate-y-4 h-12 w-12 rounded-full bg-gradient-to-br from-[#EA8A32] to-[#D6A64F] text-[#120D09] shadow-[0_8px_20px_rgba(234,138,50,0.42)] ring-4 ring-[#120D09]"
 : "-translate-y-4 h-12 w-12 rounded-full bg-gradient-to-br from-[#5138C8] to-[#2F1AA8] text-white shadow-[0_8px_20px_rgba(47,26,168,0.38)] ring-4 ring-white"
 : "h-7 w-7 rounded-full"
 }`}
 >
 <Icon className="h-5 w-5" aria-hidden />
 {(item.label === "Chat" || item.label === "Messages") && unreadChatCount > 0 && (
 <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
 <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent"></span>
 </span>
 )}
 </div>
 <span
 className={`max-w-full truncate leading-none transition-all duration-200 ${
 active ? "-mt-2" : ""
 }`}
 >
 {item.label}
 </span>
 </Link>
 </li>
 );
 })}
 </ul>
 </div>
 </nav>
 );
}
