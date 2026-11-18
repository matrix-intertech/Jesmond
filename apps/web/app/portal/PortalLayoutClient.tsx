"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import ProfileCompletionBanner from "@/components/ui/ProfileCompletionBanner";
import {
  getAccessToken,
  getCurrentUser,
  clearAuth,
  setCurrentUser,
  User,
  getDashboardRouteForUser,
} from "@/utils/auth";
import { handleApiError } from "@/utils/api";

export default function PortalLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      clearAuth();
      router.replace("/login");
      return;
    }

    const cachedUser = getCurrentUser();
    const authorize = (usr: User) => {
      if (usr.role !== "ORG_STAFF") {
        router.replace(getDashboardRouteForUser(usr));
        return;
      }

      const userOrgType = usr.orgType;
      if (!userOrgType) {
        router.replace("/settings/profile");
        return;
      }

      const userCategory = (usr.businessCategory || "").toUpperCase();
      const isAppointmentBusiness = userCategory === "SERVICES" || userCategory === "MECHANICS";
      const isFoodBusiness = userCategory === "FOOD";
      const isRetailRoute = pathname.startsWith("/portal/retail");
      const isAccommodationRoute =
        pathname === "/portal" ||
        pathname.startsWith("/portal/properties") ||
        pathname.startsWith("/portal/applications") ||
        pathname.startsWith("/portal/enquiries") ||
        pathname.startsWith("/portal/create") ||
        pathname.startsWith("/portal/leads") ||
        pathname.startsWith("/portal/agency");

      if (isAppointmentBusiness && (pathname === "/portal" || pathname === "/portal/retail" || isAccommodationRoute)) {
        router.replace("/portal/business/appointments");
        return;
      }

      if (isFoodBusiness && (pathname === "/portal" || isAccommodationRoute)) {
        router.replace("/portal/business/orders");
        return;
      }

      if (userOrgType === "RETAIL" && isAccommodationRoute) {
        if (isAppointmentBusiness) {
          router.replace("/portal/business/appointments");
        } else if (isFoodBusiness) {
          router.replace("/portal/business/orders");
        } else {
          router.replace("/portal/retail");
        }
        return;
      }

      if ((userOrgType === "PROVIDER" || userOrgType === "AGENCY") && (isRetailRoute || pathname.startsWith("/portal/business"))) {
        router.replace("/portal");
        return;
      }

      setUser(usr);
      setIsAuthorized(true);
    };

    if (cachedUser && cachedUser.orgType) {
      authorize(cachedUser);
      return;
    }

    const fetchUser = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/auth/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const status = await handleApiError(res, () => {
          clearAuth();
          router.replace("/login");
        });
        if (status === "ok") {
          const data = await res.json();
          const fetchedUser = data.user || data;
          setCurrentUser(fetchedUser);
          authorize(fetchedUser);
        } else if (status === "unauthorized") {
          // already handled
        } else {
          // non‑401 errors
        }
      } catch (e) {
        console.error("Failed to recover user via /auth/me:", e);
      }
    };
    fetchUser();
  }, []);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-surface-muted flex flex-col items-center justify-center p-8">
        <h1 className="text-xl font-semibold text-primary mb-2">Partner Portal</h1>
        <p className="text-sm text-text-secondary">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <DashboardShell role={user?.role as any}>
      <ProfileCompletionBanner />
      {children}
    </DashboardShell>
  );
}
