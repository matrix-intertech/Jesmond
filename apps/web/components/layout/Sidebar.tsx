// apps/web/components/layout/Sidebar.tsx
"use client";
import { ReactNode } from "react";
import { MessageCircle } from "lucide-react";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getCurrentUser, isBusinessHost, User } from "@/utils/auth";
import { JesmondBusinessLogo } from "../branding/JesmondBusinessLogo";
import { getStudentPortalUrl, logoutBusinessSession } from "@/utils/sso";
import { useState, useEffect } from "react";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { canUseBusinessCapability } from "@/utils/capabilities";

/**
 * Sidebar navigation for the dashboard.
 * Uses the existing inline SVG icons from the project to avoid adding new dependencies.
 * Role-based navigation items are defined in a simple config object.
 */
type NavSection = "overview" | "operations" | "compliance" | "settings";

const SECTION_ORDER: Record<NavSection, number> = {
  overview: 0,
  operations: 1,
  compliance: 2,
  settings: 3,
};

interface NavItem {
  href: string;
  label: string;
  section: NavSection;
  // Inline SVG markup for the icon (lightweight, no external library).
  icon: ReactNode;
  roles: ("SUPER_ADMIN" | "ADMIN" | "ORG_STAFF" | "STUDENT")[];
  orgTypes?: string[];
  businessCategories?: string[];
  excludeBusinessCategories?: string[];
  requiredPermissions?: string[];
  requiredCapabilities?: import("@/utils/capabilities").BusinessCapability[];
}

const navConfig: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    section: "overview",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12h18" />
        <path d="M3 6h18" />
        <path d="M3 18h18" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/admin/properties",
    label: "Properties",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/admin/users",
    label: "Users",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/admin/applications",
    label: "Applications",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1111.21 3" />
        <path d="M22 4l-10 10" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/admin/subscriptions",
    label: "Subscriptions",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
    requiredPermissions: ["SUBSCRIPTION_BILLING_VIEW"],
  },
  {
    href: "/admin/subscriptions/plans",
    label: "Subscription Plans",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
    requiredPermissions: ["SUBSCRIPTION_PLANS_MANAGE"],
  },
  {
    href: "/admin/subscriptions/enterprise",
    label: "Enterprise Plans",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
    requiredPermissions: ["SUBSCRIPTION_ENTERPRISE_MANAGE"],
  },
  {
    href: "/admin/subscriptions/features",
    label: "Feature Controls",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
    requiredPermissions: ["SUBSCRIPTION_FEATURES_MANAGE", "SUBSCRIPTION_SWITCHES_MANAGE"],
  },
  {
    href: "/admin/settings",
    label: "Settings",
    section: "settings",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/admin/credentials",
    label: "Business Credentials",
    section: "compliance",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/admin/credentials/abn-exemptions",
    label: "ABN Exemptions",
    section: "compliance",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16h16v-8l-6-6z" />
        <path d="M14 2v6h6" />
        <path d="M9 15h6" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/admin/business-name-requests",
    label: "Name Change Requests",
    section: "compliance",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  // Provider navigation
  {
    href: "/portal",
    label: "Dashboard",
    section: "overview",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12h18" />
        <path d="M3 6h18" />
        <path d="M3 18h18" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["PROVIDER", "AGENCY", "UNIVERSITY"],
  },
  {
    href: "/portal/properties",
    label: "My Properties",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["PROVIDER"],
  },
  {
    href: "/portal/applications",
    label: "Applications",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1111.21 3" />
        <path d="M22 4l-10 10" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["PROVIDER"],
  },
  {
    href: "/portal/enquiries",
    label: "Enquiries",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["PROVIDER"],
  },
  {
    href: "/portal/chats",
    label: "Chats",
    section: "operations",
    icon: <MessageCircle className="w-5 h-5" />,
    roles: ["ORG_STAFF"],
    orgTypes: ["PROVIDER"],
  },
  {
    href: "/portal/agency",
    label: "Agency",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["PROVIDER"],
  },
  {
    href: "/portal/leads",
    label: "Leads",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["PROVIDER"],
  },
  {
    href: "/portal/settings",
    label: "Settings",
    section: "settings",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06-.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["PROVIDER", "UNIVERSITY", "AGENCY"],
  },
  {
    href: "/portal/retail/settings",
    label: "Settings",
    section: "settings",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
    excludeBusinessCategories: ["FOOD", "MECHANICS", "SERVICES", "RENTALS"],
    requiredPermissions: ["RETAIL_SETTINGS_VIEW"],
  },
  {
    href: "/portal/settings/subscription",
    label: "Settings",
    section: "settings",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
    businessCategories: ["FOOD", "MECHANICS", "SERVICES", "RENTALS"],
  },
  {
    href: "/portal/business/verification",
    label: "Verification & Licences",
    section: "compliance",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
  },
  // Appointment Business Navigation (SERVICES and MECHANICS)
  {
    requiredCapabilities: ["APPOINTMENTS"],
    href: "/portal/business/appointments",
    label: "Dashboard",
    section: "overview",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
  },
  {
    requiredCapabilities: ["APPOINTMENTS"],
    href: "/portal/business/appointments?tab=list",
    label: "Appointments",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
  },
  {
    requiredCapabilities: ["APPOINTMENT_SERVICES"],
    href: "/portal/business/services",
    label: "Services",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16h16v-8l-6-6z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
  },
  {
    requiredCapabilities: ["APPOINTMENT_STAFF"],
    href: "/portal/business/staff",
    label: "Staff & Professionals",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
  },
  {
    requiredCapabilities: ["APPOINTMENT_STAFF"],
    href: "/portal/business/availability",
    label: "Availability & Time Off",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
  },
  {
    requiredCapabilities: ["APPOINTMENT_CUSTOMERS"],
    href: "/portal/business/customers",
    label: "Customers",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
  },
  // Retail Commerce Navigation (RETAIL businessCategory)
  {
    requiredCapabilities: ["CATALOG"],
    href: "/portal/retail",
    label: "Business Overview",
    section: "overview",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
    requiredPermissions: ["RETAIL_DASHBOARD_VIEW"],
  },
  {
    href: "/portal/retail/business",
    label: "Business Profile",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
  },
  {
    href: "/portal/retail/branches",
    label: "Business Branches",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16h16v-8l-6-6z" />
        <path d="M14 2v6h6" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
    requiredPermissions: ["BRANCH_VIEW"],
  },
  {
    requiredCapabilities: ["CATALOG"],
    href: "/portal/retail/employees",
    label: "Employees",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
    requiredPermissions: ["EMPLOYEES_VIEW"],
  },
  {
    requiredCapabilities: ["POS"],
    href: "/portal/retail/terminals",
    label: "Business Terminals",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
  },
  {
    requiredCapabilities: ["ORDERS"],
    href: "/portal/retail/customers",
    label: "Business Customers",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
  },
  {
    requiredCapabilities: ["CATALOG"],
    href: "/portal/retail/catalog",
    label: "Business Catalog",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
  },
  {
    requiredCapabilities: ["INVENTORY"],
    href: "/portal/retail/inventory",
    label: "Inventory",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
  },
  {
    requiredCapabilities: ["ORDERS"],
    href: "/portal/retail/orders",
    label: "Orders",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    roles: ["ORG_STAFF", "ADMIN"],
    orgTypes: ["RETAIL"],
    requiredPermissions: ["ORDERS_VIEW"],
  },
  {
    requiredCapabilities: ["ORDERS"],
    href: "/portal/retail/sales-history",
    label: "Sales History",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20v-6M6 20V10M18 20V4" />
      </svg>
    ),
    roles: ["ORG_STAFF", "ADMIN"],
    orgTypes: ["RETAIL"],
    requiredPermissions: ["ORDERS_VIEW"],
  },
  {
    requiredCapabilities: ["POS"],
    href: "/portal/retail/pos",
    label: "POS",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["RETAIL"],
  },
  {
    requiredCapabilities: ["MENU"],
    href: "/portal/business/menu",
    label: "Menu Management",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["PROVIDER"],
  },
  {
    requiredCapabilities: ["ORDERS"],
    href: "/portal/business/orders",
    label: "Food Orders",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    roles: ["ORG_STAFF"],
    orgTypes: ["PROVIDER"],
  },
  // Student navigation
  {
    href: "/student",
    label: "Dashboard",
    section: "overview",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12h18" />
        <path d="M3 6h18" />
        <path d="M3 18h18" />
      </svg>
    ),
    roles: ["STUDENT"],
  },
  {
    href: "/search",
    label: "Search Accommodation",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    roles: ["STUDENT"],
  },
  {
    href: "/student/saved",
    label: "Saved",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
    ),
    roles: ["STUDENT"],
  },
  {
    href: "/messages",
    label: "Messages",
    section: "operations",
    icon: <MessageCircle className="w-5 h-5" />,
    roles: ["STUDENT"],
  },
  {
    href: "/student#applications",
    label: "My Applications",
    section: "operations",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 12h6" />
        <path d="M9 16h6" />
        <path d="M9 8h6" />
        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
      </svg>
    ),
    roles: ["STUDENT"],
  },
  {
    href: "/settings/profile",
    label: "Settings",
    section: "settings",
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    roles: ["STUDENT"],
  },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const unreadChatCount = useUnreadChatCount();

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const visibleItems = navConfig.filter((i) => {
    if (!i.roles.includes(role as any)) return false;

    if (
      role === "ADMIN" &&
      !i.orgTypes &&
      i.requiredPermissions &&
      i.requiredPermissions.length > 0
    ) {
      const adminPerms = user?.permissions || [];
      if (!adminPerms.includes("*")) {
        const hasAdminPerm = i.requiredPermissions.some((p) =>
          adminPerms.includes(p),
        );
        if (!hasAdminPerm) return false;
      }
    }

    if (i.requiredCapabilities?.length) {
      const hasCap = i.requiredCapabilities.every((cap) =>
        canUseBusinessCapability(user?.businessCategory as any, cap),
      );
      if (!hasCap) return false;
    }
    if (i.orgTypes) {
      // Determine effective organization type
      let userOrgType = user?.orgType;
      const userCat = (user?.businessCategory || "").toUpperCase();
      if (
        !userOrgType ||
        userCat === "RETAIL" ||
        userCat === "SERVICES" ||
        userCat === "MECHANICS" ||
        userCat === "FOOD" ||
        (userCat === "RENTALS" && user?.orgType !== "PROVIDER" && user?.orgType !== "AGENCY")
      ) {
        if (
          userCat === "RETAIL" ||
          userCat === "SERVICES" ||
          userCat === "MECHANICS" ||
          userCat === "FOOD" ||
          (userCat === "RENTALS" && user?.orgType !== "PROVIDER" && user?.orgType !== "AGENCY")
        ) {
          userOrgType = "RETAIL";
        } else {
          userOrgType = userOrgType || "PROVIDER";
        }
      }
      if (!i.orgTypes.includes(userOrgType)) return false;

      if (i.businessCategories && !i.businessCategories.includes(userCat)) {
        return false;
      }
      if (i.excludeBusinessCategories && i.excludeBusinessCategories.includes(userCat)) {
        return false;
      }

      // If it's a RETAIL org, check permissions
      if (userOrgType === "RETAIL" && i.requiredPermissions) {
        // Owner override
        if (user?.orgRole === "ADMIN") return true;

        const userPerms = user?.permissions || [];
        if (userPerms.includes("*")) return true;

        const hasPerm = i.requiredPermissions.some((p) =>
          userPerms.includes(p),
        );
        if (!hasPerm) return false;
      }
    }
    return true;
  });

  // Sort stably by standardized section order: overview -> operations -> compliance -> settings
  const orderedItems = [...visibleItems].sort(
    (a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section],
  );

  const handleLogout = async () => {
    await logoutBusinessSession();
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="fixed left-3 top-3 z-[70] flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-surface text-primary shadow-sm transition hover:bg-surface-muted lg:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        {/* Simple menu icon */}
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Sidebar hidden on mobile unless open */}
      <nav
        className={`fixed inset-y-0 left-0 z-[70] flex w-[min(18rem,calc(100vw-2rem))] flex-shrink-0 flex-col border-r border-border-strong/60 bg-surface transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:translate-x-0 ${open ? "translate-x-0 shadow-2xl" : "-translate-x-[110%]"}`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <Link href="/" className="group">
            {role === "ORG_STAFF" || isBusinessHost() ? (
              <JesmondBusinessLogo size="sm" />
            ) : (
              <Image
                src="/assets/logo_navbar.png"
                alt="Jesmond"
                width={120}
                height={30}
                className="h-8 w-auto"
                priority
              />
            )}
          </Link>
          <button
            className="lg:hidden p-2 text-text-secondary hover:bg-surface-muted rounded-lg transition"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto px-4 space-y-1 mt-2" data-testid="sidebar-nav-list">
          {orderedItems.map((item, idx) => {
            const prevSection = idx > 0 ? orderedItems[idx - 1].section : item.section;
            const showDivider =
              idx > 0 &&
              prevSection !== item.section &&
              (item.section === "compliance" || item.section === "settings");
            const isSettingsItem = item.href === "/settings/profile";
            const isActive =
              pathname === item.href ||
              (isSettingsItem && !!pathname?.startsWith("/settings/")) ||
              (item.href !== "/admin" &&
                item.href !== "/portal" &&
                item.href !== "/student" &&
                !isSettingsItem &&
                !!pathname?.startsWith(`${item.href}/`));
            return (
              <li
                key={item.href}
                data-section={item.section}
                className={showDivider ? "pt-2 mt-2 border-t border-border-subtle" : undefined}
              >
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-11 items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? "bg-accent/10 text-accent font-semibold shadow-sm" : "text-primary/90 hover:bg-surface-muted hover:text-primary"}`}
                >
                  <div
                    className={`relative ${isActive ? "text-accent" : "text-text-secondary"}`}
                  >
                    {item.icon}
                    {item.label === "Messages" && unreadChatCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
                      </span>
                    )}
                  </div>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="p-4 mx-4 mb-4 mt-auto bg-surface-muted rounded-2xl border border-border-subtle">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-orange to-orange-500 flex items-center justify-center text-sm font-bold text-white shadow-sm">
              {user?.firstName?.[0] ?? "U"}
            </div>
            <div className="flex-1 text-sm overflow-hidden">
              <div className="font-semibold text-primary truncate">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-text-secondary text-xs truncate">
                {user?.email}
              </div>
            </div>
          </div>
          <a
            href={getStudentPortalUrl()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-2 bg-surface border border-border-strong rounded-xl text-text-primary hover:bg-surface-muted transition-all font-medium text-sm shadow-sm"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Visit Site
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border-strong rounded-xl text-text-primary hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all font-medium text-sm shadow-sm"
          >
            <svg
              className="w-4 h-4"
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
            Sign Out
          </button>
        </div>
      </nav>
    </>
  );
}
