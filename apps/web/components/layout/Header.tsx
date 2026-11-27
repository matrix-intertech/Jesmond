// apps/web/components/layout/Header.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentUser, getDashboardHeading, getAccessToken, isAuthenticated, isBusinessHost, User } from "@/utils/auth";
import { NotificationDropdown } from "../notifications/NotificationDropdown";
import { QuickstartHeaderButton } from "../quickstart/QuickstartHeaderButton";
import { JesmondBusinessLogo } from "../branding/JesmondBusinessLogo";
import { Menu, ShieldAlert, ShieldCheck } from "lucide-react";
import { getCredentialsRequirements } from "@/services/credentials.service";

interface HeaderProps {
  user?: User | null;
  mobileNavOpen?: boolean;
  onOpenMobileNav?: () => void;
}

export default function Header({ user: propUser, mobileNavOpen = false, onOpenMobileNav }: HeaderProps) {
  const [user, setUser] = useState<User | null>(propUser ?? null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
    } else {
      setUser(getCurrentUser());
    }
  }, [propUser]);

  useEffect(() => {
    const handleStorage = () => {
      setUser(getCurrentUser());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const effectiveUser = user ?? propUser ?? (typeof window !== "undefined" ? getCurrentUser() : null);

  useEffect(() => {
    if (effectiveUser?.role !== "ORG_STAFF") {
      setVerificationStatus(null);
      return;
    }

    const token = getAccessToken();
    if (!token && !isAuthenticated()) return;

    let mounted = true;
    getCredentialsRequirements(token || undefined)
      .then((res) => {
        if (mounted) {
          setVerificationStatus(res.overallStatus || "NOT_SUBMITTED");
        }
      })
      .catch(() => {
        // Graceful fallback
      });

    return () => {
      mounted = false;
    };
  }, [effectiveUser?.role]);

  const heading = getDashboardHeading(effectiveUser);

  const isBusinessPortal = effectiveUser?.role === "ORG_STAFF" || (typeof window !== "undefined" && isBusinessHost());

  return (
    <header className="flex items-center justify-between gap-2 bg-surface/90 backdrop-blur-md border-b border-border-strong/60 px-3 sm:px-6 h-16 lg:h-[76px] sticky top-0 z-20">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {onOpenMobileNav && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Toggle navigation"
            aria-expanded={mobileNavOpen}
            className="lg:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-surface text-primary shadow-sm transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {isBusinessPortal && (
          <Link href="/" className="lg:hidden flex items-center min-w-0 group">
            <JesmondBusinessLogo size="sm" />
          </Link>
        )}
        <h2
          data-testid="dashboard-header-title"
          className={`${isBusinessPortal ? "sr-only lg:not-sr-only" : ""} text-lg sm:text-xl md:text-2xl font-bold font-outfit text-primary tracking-tight truncate`}
        >
          {heading}
        </h2>
        {effectiveUser?.role === "ORG_STAFF" && verificationStatus && (
          verificationStatus === "VERIFIED" ? (
            <div
              data-testid="header-verification-verified-pill"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Verified Partner</span>
            </div>
          ) : (
            <Link
              href="/portal/business/verification"
              data-testid="header-verification-pill"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <ShieldAlert size={14} className="text-amber-500" />
              <span>Verification Incomplete • Verify Now →</span>
            </Link>
          )
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <QuickstartHeaderButton />
        <NotificationDropdown
          organizationId={
            effectiveUser?.role === "ORG_STAFF"
              ? effectiveUser?.organizationId || undefined
              : undefined
          }
        />
      </div>
    </header>
  );
}
