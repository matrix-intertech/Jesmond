// apps/web/components/layout/Header.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentUser, getDashboardHeading, getAccessToken, User } from "@/utils/auth";
import { NotificationDropdown } from "../notifications/NotificationDropdown";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getCredentialsRequirements } from "@/services/credentials.service";

interface HeaderProps {
  user?: User | null;
}

export default function Header({ user: propUser }: HeaderProps) {
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
    if (!token) return;

    let mounted = true;
    getCredentialsRequirements(token)
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

  return (
    <header className="flex items-center justify-between bg-surface/80 backdrop-blur-md border-b border-border-strong/60 px-4 sm:px-6 h-[76px] sticky top-0 z-20">
      <div className="flex items-center gap-3 pl-12 lg:pl-0 min-w-0">
        <h2
          data-testid="dashboard-header-title"
          className="text-lg sm:text-xl md:text-2xl font-bold font-outfit text-primary tracking-tight truncate"
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
      <div className="flex items-center gap-4 shrink-0">
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
