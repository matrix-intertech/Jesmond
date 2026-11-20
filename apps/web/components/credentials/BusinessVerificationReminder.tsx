"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAccessToken, getCurrentUser } from "@/utils/auth";
import {
  getCredentialsRequirements,
  dismissCompletionReminder,
  RequirementsResponseDto,
} from "@/services/credentials.service";
import { ShieldAlert, ShieldCheck, X, ArrowRight } from "lucide-react";

export default function BusinessVerificationReminder() {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<RequirementsResponseDto | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    // Never show on the verification page itself or non-portal routes
    if (pathname.startsWith("/portal/business/verification") || pathname.startsWith("/login")) {
      setShowModal(false);
      return;
    }

    const user = getCurrentUser();
    if (!user || user.role !== "ORG_STAFF") {
      return;
    }

    const checkStatus = async () => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const reqs = await getCredentialsRequirements(token);
        setData(reqs);

        // If completed or verified, do not show modal
        if (reqs.isCompleted || reqs.overallStatus === "VERIFIED") {
          setShowModal(false);
          return;
        }

        // Check 14-day dismissal window
        if (reqs.dismissedUntil) {
          const dismissedDate = new Date(reqs.dismissedUntil);
          if (dismissedDate > new Date()) {
            setShowModal(false);
            return;
          }
        }

        // Check sessionStorage to prevent annoying user on every intra-session tab click
        if (sessionStorage.getItem("biz_verification_session_dismissed")) {
          setShowModal(false);
          return;
        }

        setShowModal(true);
      } catch (e) {
        // Non-blocking: fail gracefully without disrupting dashboard
        console.warn("Failed to check credential verification status", e);
      }
    };

    checkStatus();
  }, [pathname]);

  const handleDismiss = async () => {
    sessionStorage.setItem("biz_verification_session_dismissed", "true");
    setShowModal(false);
    setIsDismissing(true);
    try {
      const token = getAccessToken();
      if (token) {
        await dismissCompletionReminder(token);
      }
    } catch (e) {
      console.warn("Failed to persist 14-day dismissal on server", e);
    } finally {
      setIsDismissing(false);
    }
  };

  const handleNavigate = () => {
    sessionStorage.setItem("biz_verification_session_dismissed", "true");
    setShowModal(false);
    router.push("/portal/business/verification");
  };

  if (!showModal || !data) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="verification-dialog-title"
      data-testid="business-verification-modal"
      className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div className="bg-surface rounded-2xl shadow-xl max-w-lg w-full p-6 sm:p-8 border border-border-strong relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={handleDismiss}
          disabled={isDismissing}
          data-testid="business-verification-close-btn"
          aria-label="Close verification popup"
          className="absolute top-4 right-4 p-2 text-text-tertiary hover:text-text-primary rounded-lg transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
            <ShieldAlert size={26} />
          </div>
          <div>
            <h3
              id="verification-dialog-title"
              className="text-xl font-bold font-outfit text-primary tracking-tight"
            >
              Verify Your Business Credentials
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Category: {data.businessCategory} • State: {data.state}
            </p>
          </div>
        </div>

        <p className="text-sm text-text-secondary mb-5 leading-relaxed">
          Complete statutory credential requirements for{" "}
          <strong className="text-text-primary">{data.organizationName}</strong> to
          earn the <span className="text-emerald-600 font-semibold">Verified Partner</span> badge on
          Jesmond, unlock public trust, and showcase your certified licensing.
        </p>

        <div className="bg-surface-muted rounded-xl p-4 mb-6 border border-border-strong/60 space-y-2">
          <div className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Required Licences & Identity:
          </div>
          <div className="text-xs text-text-secondary flex items-center gap-2">
            <ShieldCheck size={16} className="text-accent shrink-0" />
            <span>
              ABN Identity Check (
              {data.abnStatus === "VERIFIED"
                ? "Verified"
                : data.abnStatus === "EXEMPTION_PENDING"
                ? "Exemption Pending"
                : "Required"}
              )
            </span>
          </div>
          {data.requirements.map((req) => (
            <div
              key={req.credentialCode}
              className="text-xs text-text-secondary flex items-center gap-2"
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  req.isSatisfied ? "bg-emerald-500" : "bg-amber-400"
                }`}
              />
              <span className="truncate">
                {req.name} ({req.verificationAuthority})
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isDismissing}
            data-testid="business-verification-dismiss-btn"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border text-text-secondary font-medium text-sm hover:bg-surface-muted transition-colors text-center"
          >
            Maybe Later (14 days)
          </button>
          <button
            type="button"
            onClick={handleNavigate}
            data-testid="business-verification-start-btn"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 shadow-sm shadow-brand-navy/20"
          >
            <span>Verify Now</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
