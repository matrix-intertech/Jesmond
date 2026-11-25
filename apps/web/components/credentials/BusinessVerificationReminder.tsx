"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  getAccessToken,
  getCurrentUser,
  getSelectedOrganizationId,
} from "@/utils/auth";
import {
  getCredentialsRequirements,
  dismissCompletionReminder,
  RequirementsResponseDto,
} from "@/services/credentials.service";
import { ShieldAlert, ShieldCheck, X, ArrowRight, AlertCircle } from "lucide-react";

const getSessionDismissKey = (orgId?: string | null) =>
  `biz_profile_completion_dismissed_${orgId || "default"}`;

export default function BusinessVerificationReminder() {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<RequirementsResponseDto | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [completionTarget, setCompletionTarget] = useState("/portal/business/verification");

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || user.role !== "ORG_STAFF") {
      setShowModal(false);
      setData(null);
      return;
    }

    const activeOrgId = getSelectedOrganizationId() || user.organizationId;
    const isOnboardingOrVerificationPage =
      pathname.startsWith("/portal/business/verification") ||
      pathname.startsWith("/business/onboarding") ||
      pathname.startsWith("/login");

    const checkStatus = async () => {
      const token = getAccessToken();

      if (!activeOrgId) {
        setCompletionTarget("/business/onboarding");
        const fallbackData: RequirementsResponseDto = {
          organizationId: "pending",
          organizationName: "Your Business",
          businessCategory: user.businessCategory || user.orgType || "BUSINESS",
          state: "NSW",
          branchAddress: null,
          selectedServices: [],
          abn: null,
          abnStatus: "REQUIRED",
          abnExemptionReason: null,
          overallStatus: "PENDING",
          isCompleted: false,
          dismissedUntil: null,
          requirements: [],
        };
        setData(fallbackData);

        if (isOnboardingOrVerificationPage) {
          setShowModal(false);
          return;
        }
        if (sessionStorage.getItem(getSessionDismissKey(null))) {
          setShowModal(false);
          return;
        }
        setShowModal(true);
        return;
      }

      setCompletionTarget("/portal/business/verification");

      try {
        const reqs = await getCredentialsRequirements(token);
        if (!reqs || !Array.isArray(reqs.requirements)) {
          setShowModal(false);
          return;
        }
        setData(reqs);

        // If completed or verified, permanently stop showing popup & reminder
        if (reqs.isCompleted || reqs.overallStatus === "VERIFIED") {
          setShowModal(false);
          return;
        }

        if (isOnboardingOrVerificationPage) {
          setShowModal(false);
          return;
        }

        const orgKey = reqs.organizationId || activeOrgId;

        // Check backend reminder cycle (e.g. 14-day dismissal window)
        if (reqs.dismissedUntil) {
          const dismissedDate = new Date(reqs.dismissedUntil);
          if (dismissedDate > new Date()) {
            setShowModal(false);
            return;
          }
        }

        // Persist dismissal within session per organization
        if (sessionStorage.getItem(getSessionDismissKey(orgKey))) {
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
    const user = getCurrentUser();
    const orgKey =
      data?.organizationId && data.organizationId !== "pending"
        ? data.organizationId
        : getSelectedOrganizationId() || user?.organizationId;

    sessionStorage.setItem(getSessionDismissKey(orgKey), "true");
    setShowModal(false);
    setIsDismissing(true);
    try {
      const token = getAccessToken();
      if (orgKey) {
        await dismissCompletionReminder(token);
      }
    } catch (e) {
      console.warn("Failed to persist dismissal reminder on server", e);
    } finally {
      setIsDismissing(false);
    }
  };

  const handleNavigate = () => {
    setShowModal(false);
    router.push(completionTarget);
  };

  const isPending =
    !!data && !data.isCompleted && data.overallStatus !== "VERIFIED";

  if (!isPending) return null;

  const isOnCompletionPage =
    pathname.startsWith("/portal/business/verification") ||
    pathname.startsWith("/business/onboarding");

  return (
    <>
      {!isOnCompletionPage && (
        <div
          role="status"
          data-testid="profile-completion-pending-banner"
          className="mb-4 rounded-xl border border-amber-300/70 bg-amber-50/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm"
        >
          <div className="flex items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div className="text-sm">
              <span className="font-semibold text-amber-950">
                Profile Completion: Pending
              </span>
              <span className="text-amber-800 ml-0 sm:ml-2 block sm:inline">
                Your business profile still needs some information.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleNavigate}
            data-testid="profile-completion-banner-btn"
            className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
          >
            <span>Complete Profile</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {showModal && data && Array.isArray(data.requirements) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verification-dialog-title"
          data-testid="business-verification-modal"
          className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div className="bg-surface rounded-2xl shadow-xl max-w-lg w-full p-6 sm:p-8 border border-border-strong relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isDismissing}
              data-testid="business-verification-close-btn"
              aria-label="Close profile completion popup"
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
                  Complete Your Business Profile
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {data.organizationName} • Category: {data.businessCategory}
                </p>
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-5 leading-relaxed">
              Your business profile is not fully completed yet. Complete the remaining details to improve your business presence and help customers learn more about your business.
            </p>

            {data.requirements.length > 0 && (
              <div className="bg-surface-muted rounded-xl p-4 mb-6 border border-border-strong/60 space-y-2">
                <div className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Pending Profile &amp; Verification Items:
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
            )}

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isDismissing}
                data-testid="business-verification-dismiss-btn"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border text-text-secondary font-medium text-sm hover:bg-surface-muted transition-colors text-center"
              >
                Remind Me Later
              </button>
              <button
                type="button"
                onClick={handleNavigate}
                data-testid="business-verification-start-btn"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 shadow-sm shadow-brand-navy/20"
              >
                <span>Complete Profile</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
