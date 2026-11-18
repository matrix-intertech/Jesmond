"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import ProfileCompletionBanner from "@/components/ui/ProfileCompletionBanner";
import {
  restoreUserSession,
  clearAuth,
  User,
  getDashboardRouteForUser,
} from "@/utils/auth";
import { AlertCircle, RefreshCw, LogOut } from "lucide-react";

export default function PortalLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const authorize = useCallback((usr: User): boolean => {
    if (usr.role !== "ORG_STAFF") {
      router.replace(getDashboardRouteForUser(usr));
      return false;
    }

    const userOrgType = usr.orgType;
    if (!userOrgType) {
      router.replace("/settings/profile");
      return false;
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
      return false;
    }

    if (isFoodBusiness && (pathname === "/portal" || isAccommodationRoute)) {
      router.replace("/portal/business/orders");
      return false;
    }

    if (userOrgType === "RETAIL" && isAccommodationRoute) {
      if (isAppointmentBusiness) {
        router.replace("/portal/business/appointments");
      } else if (isFoodBusiness) {
        router.replace("/portal/business/orders");
      } else {
        router.replace("/portal/retail");
      }
      return false;
    }

    if ((userOrgType === "PROVIDER" || userOrgType === "AGENCY") && (isRetailRoute || pathname.startsWith("/portal/business"))) {
      router.replace("/portal");
      return false;
    }

    setUser(usr);
    setIsAuthorized(true);
    return true;
  }, [pathname, router]);

  const initAuth = useCallback(async (forceRefresh = false) => {
    setError(null);
    if (forceRefresh) setIsRetrying(true);

    const result = await restoreUserSession({ forceRefresh });

    if (result.status === "unauthorized") {
      clearAuth();
      router.replace("/login");
      return;
    }

    if (result.status === "forbidden") {
      setError(result.error || "Access to partner portal is restricted.");
      setIsRetrying(false);
      return;
    }

    if (result.status === "ok" && result.user) {
      const authorized = authorize(result.user);
      setIsRetrying(false);
      if (!authorized) {
        // Redirection triggered in authorize()
        return;
      }
      return;
    }

    setError(result.error || "Unable to load partner dashboard. Please try again.");
    setIsRetrying(false);
  }, [authorize, router]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  if (!isAuthorized) {
    if (error) {
      return (
        <div className="min-h-screen bg-surface-muted flex flex-col items-center justify-center p-8">
          <div className="max-w-md w-full bg-surface-card p-6 rounded-xl border border-border shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">Partner Portal Error</h2>
            <p className="text-sm text-text-secondary mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => initAuth(true)}
                disabled={isRetrying}
                className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={16} className={`mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? "Connecting..." : "Retry"}
              </button>
              <button
                type="button"
                onClick={() => { clearAuth(); router.replace("/login"); }}
                className="inline-flex items-center justify-center px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-muted transition-colors"
              >
                <LogOut size={16} className="mr-2" />
                Return to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

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
