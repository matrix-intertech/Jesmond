"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken } from "@/utils/auth";
import {
  getCredentialsRequirements,
  verifyAbn,
  requestAbnExemption,
  saveCredentialDraft,
  uploadCredentialDocument,
  getDocumentSignedUrl,
  submitCredentials,
  RequirementsResponseDto,
  CredentialRequirementDto,
} from "@/services/credentials.service";
import { cleanAbn, formatAbn, validateAbnChecksum } from "@/utils/abn";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  UploadCloud,
  FileText,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Lock,
  Building,
  HelpCircle,
  Eye,
} from "lucide-react";

export default function BusinessVerificationPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RequirementsResponseDto | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Step 1: ABN state
  const [abnInput, setAbnInput] = useState("");
  const [abnVerifying, setAbnVerifying] = useState(false);
  const [abnResult, setAbnResult] = useState<{
    verified: boolean;
    entityName?: string;
    status?: string;
    gstRegistered?: boolean;
  } | null>(null);
  const [showExemptionForm, setShowExemptionForm] = useState(false);
  const [exemptionReason, setExemptionReason] = useState("");
  const [submittingExemption, setSubmittingExemption] = useState(false);

  // Step 3: Licences state (keyed by credentialCode)
  const [licenceForms, setLicenceForms] = useState<
    Record<
      string,
      { licenceNumber: string; licenceName: string; expiresAt: string }
    >
  >({});

  // Step 4: Document upload state
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const loadRequirements = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await getCredentialsRequirements(token);
      setData(res);

      if (res.abn) {
        setAbnInput(formatAbn(res.abn));
        setAbnResult({ verified: res.abnStatus === "VERIFIED" });
      }

      // Initialize licence form inputs from current credentials
      const initialForms: Record<string, any> = {};
      res.requirements.forEach((req) => {
        initialForms[req.credentialCode] = {
          licenceNumber: req.currentCredential?.licenceNumber || "",
          licenceName: req.currentCredential?.licenceName || "",
          expiresAt: req.currentCredential?.expiresAt
            ? req.currentCredential.expiresAt.split("T")[0]
            : "",
        };
      });
      setLicenceForms(initialForms);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to load credential requirements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements]);

  // ABN Verification Handler
  const handleVerifyAbn = async () => {
    const clean = cleanAbn(abnInput);
    if (!validateAbnChecksum(clean)) {
      setErrorMsg("Invalid Australian Business Number (Modulus 89 checksum failed).");
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    try {
      setAbnVerifying(true);
      setErrorMsg(null);
      const res = await verifyAbn(token, clean);
      setAbnResult({
        verified: true,
        entityName: res.entityName,
        status: res.status,
        gstRegistered: res.gstRegistered,
      });
      setSuccessMsg(`ABN successfully verified for ${res.entityName}!`);
      // Reload requirements to update overall ABN status
      await loadRequirements();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to verify ABN with ABR registry");
    } finally {
      setAbnVerifying(false);
    }
  };

  // ABN Exemption Request Handler
  const handleRequestExemption = async () => {
    if (!exemptionReason.trim()) {
      setErrorMsg("Please provide a legitimate reason for ABN exemption.");
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    try {
      setSubmittingExemption(true);
      setErrorMsg(null);
      await requestAbnExemption(token, exemptionReason.trim());
      setSuccessMsg("ABN exemption request submitted for compliance review.");
      setShowExemptionForm(false);
      await loadRequirements();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to submit exemption request");
    } finally {
      setSubmittingExemption(false);
    }
  };

  // Draft Saving on Step Transition or Blur
  const handleSaveDraft = async (code: string) => {
    const form = licenceForms[code];
    if (!form || !form.licenceNumber) return;

    const token = getAccessToken();
    if (!token) return;

    try {
      setSavingDraft(true);
      await saveCredentialDraft(token, code, {
        licenceNumber: form.licenceNumber,
        licenceName: form.licenceName,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      });
      await loadRequirements();
    } catch (e: any) {
      console.warn("Failed to save draft", e);
    } finally {
      setSavingDraft(false);
    }
  };

  // Document Upload Handler
  const handleFileUpload = async (
    credentialId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Client-side validation: max 10MB and PDF/Image
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File size exceeds 10MB limit.");
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    try {
      setUploadingDoc(credentialId);
      setErrorMsg(null);
      await uploadCredentialDocument(token, credentialId, file);
      setSuccessMsg(`Document "${file.name}" securely uploaded.`);
      await loadRequirements();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to upload document");
    } finally {
      setUploadingDoc(null);
    }
  };

  // Open Signed Document URL
  const handleViewDocument = async (credentialId: string, docId: string) => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await getDocumentSignedUrl(token, credentialId, docId);
      window.open(res.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to generate secure document link");
    }
  };

  // Submit Credentials Handler
  const handleSubmit = async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);
      await submitCredentials(token);
      setSuccessMsg("Credentials successfully submitted for compliance review!");
      await loadRequirements();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to submit credentials");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={32} className="animate-spin text-accent" />
        <p className="text-sm text-text-secondary">Loading verification status...</p>
      </div>
    );
  }

  if (!data) return null;

  const steps = [
    { num: 1, label: "Business Identity" },
    { num: 2, label: "Selected Services" },
    { num: 3, label: "Applicable Licences" },
    { num: 4, label: "Document Uploads" },
    { num: 5, label: "Review & Submit" },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-outfit text-primary tracking-tight">
              Business Credentials & Verification
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Statutory licensing, identity verification, and verified partner badge management
            </p>
          </div>
          <div className="shrink-0">
            {data.overallStatus === "VERIFIED" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck size={16} /> Verified Partner
              </span>
            ) : data.overallStatus === "PARTIALLY_VERIFIED" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Shield size={16} /> Under Compliance Review
              </span>
            ) : data.overallStatus === "ACTION_REQUIRED" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle size={16} /> Action Required
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <ShieldAlert size={16} /> Verification Incomplete
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-3">
          <CheckCircle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">{successMsg}</div>
        </div>
      )}

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border-strong -translate-y-1/2 z-0" />
          {steps.map((s) => {
            const isActive = currentStep === s.num;
            const isPassed = currentStep > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setCurrentStep(s.num)}
                className={`relative z-10 flex flex-col items-center gap-2 group cursor-pointer focus:outline-none`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    isActive
                      ? "bg-primary text-white ring-4 ring-primary/20"
                      : isPassed
                      ? "bg-emerald-600 text-white"
                      : "bg-surface border border-border-strong text-text-secondary"
                  }`}
                >
                  {isPassed ? <CheckCircle size={18} /> : s.num}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    isActive ? "text-primary font-bold" : "text-text-secondary"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content Card */}
      <div className="bg-surface rounded-2xl border border-border-strong p-6 sm:p-8 shadow-sm mb-8">
        {/* Step 1: Business Identity & ABN */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="border-b border-border-strong pb-4">
              <h2 className="text-xl font-bold font-outfit text-primary">
                Step 1: Business Identity & ABN
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Confirm your business details and verify your Australian Business Number.
              </p>
            </div>

            {/* Read-only existing details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface-muted p-4 rounded-xl border border-border-strong/60">
              <div>
                <div className="text-xs text-text-secondary font-medium uppercase">
                  Business Name
                </div>
                <div className="text-sm font-bold text-primary mt-0.5">
                  {data.organizationName}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-secondary font-medium uppercase">
                  Category
                </div>
                <div className="text-sm font-semibold text-primary mt-0.5">
                  {data.businessCategory}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-secondary font-medium uppercase">
                  Jurisdiction / State
                </div>
                <div className="text-sm font-semibold text-primary mt-0.5">
                  {data.state}
                </div>
              </div>
              {data.branchAddress && (
                <div className="sm:col-span-3 border-t border-border-strong/40 pt-2 mt-1">
                  <div className="text-xs text-text-secondary font-medium uppercase">
                    Operating Branch Address
                  </div>
                  <div className="text-sm text-text-primary mt-0.5">
                    {data.branchAddress}
                  </div>
                </div>
              )}
            </div>

            {/* ABN Verification Input */}
            <div className="space-y-3">
              <label
                htmlFor="abn-input"
                className="block text-sm font-semibold text-text-primary"
              >
                Australian Business Number (ABN)
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="abn-input"
                  type="text"
                  placeholder="51 824 753 556"
                  value={abnInput}
                  onChange={(e) => setAbnInput(formatAbn(e.target.value))}
                  disabled={data.abnStatus === "VERIFIED"}
                  data-testid="abn-input"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={handleVerifyAbn}
                  disabled={
                    abnVerifying ||
                    !abnInput.trim() ||
                    data.abnStatus === "VERIFIED"
                  }
                  data-testid="verify-abn-btn"
                  className="px-5 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {abnVerifying ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  <span>
                    {data.abnStatus === "VERIFIED" ? "Verified" : "Verify ABN"}
                  </span>
                </button>
              </div>

              {data.abnStatus === "VERIFIED" && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>
                    Official ABN active and verified. ABN is securely stored on your
                    business organization.
                  </span>
                </div>
              )}

              {data.abnStatus === "EXEMPTION_PENDING" && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
                  <Shield size={16} className="text-blue-600 shrink-0" />
                  <span>
                    ABN Exemption submitted and pending compliance review. Reason: "
                    {data.abnExemptionReason}"
                  </span>
                </div>
              )}

              {data.abnStatus === "EXEMPTION_APPROVED" && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>
                    Statutory ABN exemption approved by Jesmond compliance.
                  </span>
                </div>
              )}

              {/* Exemption Toggle */}
              {data.abnStatus !== "VERIFIED" &&
                data.abnStatus !== "EXEMPTION_APPROVED" && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExemptionForm(!showExemptionForm)}
                      data-testid="request-exemption-toggle"
                      className="text-xs text-text-secondary hover:text-accent font-medium inline-flex items-center gap-1.5"
                    >
                      <HelpCircle size={14} />
                      <span>
                        Do not have an ABN? Click here to request an exemption.
                      </span>
                    </button>

                    {showExemptionForm && (
                      <div className="mt-3 p-4 bg-surface-muted rounded-xl border border-border-strong/60 space-y-3">
                        <label
                          htmlFor="exemption-reason-input"
                          className="block text-xs font-semibold text-text-primary"
                        >
                          Reason for Exemption (Australian ATO criteria)
                        </label>
                        <textarea
                          id="exemption-reason-input"
                          rows={3}
                          value={exemptionReason}
                          onChange={(e) => setExemptionReason(e.target.value)}
                          placeholder="e.g. Activity conducted as a hobby without reasonable expectation of profit, or foreign entity operating without permanent Australian establishment."
                          data-testid="exemption-reason-input"
                          className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleRequestExemption}
                            disabled={submittingExemption || !exemptionReason.trim()}
                            data-testid="submit-exemption-btn"
                            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
                          >
                            {submittingExemption ? "Submitting..." : "Submit Exemption Request"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Step 2: Selected Services */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="border-b border-border-strong pb-4">
              <h2 className="text-xl font-bold font-outfit text-primary">
                Step 2: Selected Services
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Licensing requirements are dynamically resolved according to your registered category, active services, and branch location.
              </p>
            </div>

            <div className="space-y-4">
              <div className="text-sm font-semibold text-text-primary">
                Active Category Services
              </div>
              {data.selectedServices && data.selectedServices.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {data.selectedServices.map((srv, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-lg bg-surface-muted border border-border text-xs font-medium text-text-primary"
                    >
                      {srv}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-surface-muted rounded-xl text-xs text-text-secondary">
                  General {data.businessCategory} operations. Standard statutory category requirements apply for {data.state}.
                </div>
              )}

              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 flex items-start gap-3 mt-4">
                <Lock size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Dynamic Resolution:</strong> If your services require specialized trade licensing (such as NSW Motor Vehicle Repairer Licence, Queensland Automotive Safety Certificate Approval, or QBCC Electrical/Plumbing licenses), they are automatically included in the next step. Non-trade services require no redundant documentation.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Applicable Licences */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="border-b border-border-strong pb-4">
              <h2 className="text-xl font-bold font-outfit text-primary">
                Step 3: Applicable Licences & Registrations
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Enter your official licence numbers for statutory verification. Drafts auto-save.
              </p>
            </div>

            {data.requirements.length === 0 ? (
              <div className="p-6 text-center text-text-secondary text-sm">
                No statutory licences required for your business category and state.
              </div>
            ) : (
              <div className="space-y-6">
                {data.requirements.map((req) => {
                  const form = licenceForms[req.credentialCode] || {
                    licenceNumber: "",
                    licenceName: "",
                    expiresAt: "",
                  };
                  const current = req.currentCredential;

                  return (
                    <div
                      key={req.credentialCode}
                      className="p-5 rounded-2xl border border-border bg-surface-muted/40 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-primary font-outfit">
                              {req.name}
                            </h3>
                            {req.isMandatory && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                Mandatory
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-1">
                            {req.description}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {current?.status === "VERIFIED" ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <ShieldCheck size={14} /> Verified
                            </span>
                          ) : current?.status === "PENDING_REVIEW" ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                              <Shield size={14} /> Pending Review
                            </span>
                          ) : current?.status === "REJECTED" ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                              <AlertTriangle size={14} /> Action Required
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Draft
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reviewer rejection or feedback notice */}
                      {current?.reviewerNotes && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                          <strong>Compliance Reviewer Feedback:</strong>{" "}
                          {current.reviewerNotes}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor={`licence-number-${req.credentialCode}`}
                            className="block text-xs font-semibold text-text-primary mb-1"
                          >
                            Licence / Registration Number
                          </label>
                          <input
                            id={`licence-number-${req.credentialCode}`}
                            type="text"
                            placeholder="e.g. MVRL12345"
                            value={form.licenceNumber}
                            onChange={(e) =>
                              setLicenceForms((prev) => ({
                                ...prev,
                                [req.credentialCode]: {
                                  ...prev[req.credentialCode],
                                  licenceNumber: e.target.value,
                                },
                              }))
                            }
                            onBlur={() => handleSaveDraft(req.credentialCode)}
                            data-testid={`licence-number-${req.credentialCode}`}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`licence-expiry-${req.credentialCode}`}
                            className="block text-xs font-semibold text-text-primary mb-1"
                          >
                            Expiry Date
                          </label>
                          <input
                            id={`licence-expiry-${req.credentialCode}`}
                            type="date"
                            value={form.expiresAt}
                            onChange={(e) =>
                              setLicenceForms((prev) => ({
                                ...prev,
                                [req.credentialCode]: {
                                  ...prev[req.credentialCode],
                                  expiresAt: e.target.value,
                                },
                              }))
                            }
                            onBlur={() => handleSaveDraft(req.credentialCode)}
                            data-testid={`licence-expiry-${req.credentialCode}`}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-text-secondary pt-1">
                        <div>
                          Regulator: <strong>{req.verificationAuthority}</strong>
                        </div>
                        {req.authorityUrl && (
                          <a
                            href={req.authorityUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-accent hover:underline"
                          >
                            <span>Official Registry Portal</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Document Uploads */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-border-strong pb-4">
              <h2 className="text-xl font-bold font-outfit text-primary">
                Step 4: Private Supporting Documents
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Upload clear certificate copies or licence card scans (PDF, PNG, JPG up to 10MB).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <Lock size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Strict Privacy Guarantee:</strong> Supporting documents are stored in encrypted private Cloudflare R2 storage, are accessible only by verified Jesmond compliance administrators through 15-minute temporary signed links, and will <strong>never</strong> be displayed on public storefronts or customer profiles.
              </div>
            </div>

            <div className="space-y-6">
              {data.requirements.map((req) => {
                const credentialId = req.currentCredential?.id;
                const docs = req.currentCredential?.documents || [];

                return (
                  <div
                    key={req.credentialCode}
                    className="p-5 rounded-2xl border border-border bg-surface-muted/30 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-primary font-outfit">
                        {req.name} Document
                      </div>
                      <span className="text-xs text-text-secondary">
                        {docs.length} uploaded
                      </span>
                    </div>

                    {docs.length > 0 && (
                      <div className="space-y-2">
                        {docs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileText size={16} className="text-accent shrink-0" />
                              <span className="font-medium text-text-primary truncate">
                                {doc.filename}
                              </span>
                              <span className="text-text-secondary shrink-0">
                                ({(doc.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleViewDocument(credentialId!, doc.id)
                              }
                              data-testid={`view-doc-${doc.id}`}
                              className="px-2.5 py-1 rounded-lg text-accent hover:bg-surface-muted font-medium inline-flex items-center gap-1 transition-colors"
                            >
                              <Eye size={14} />
                              <span>Preview</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {credentialId ? (
                      <div className="relative border-2 border-dashed border-border-strong rounded-xl p-4 text-center hover:bg-surface-muted transition-colors">
                        <input
                          type="file"
                          accept=".pdf,image/png,image/jpeg"
                          onChange={(e) => handleFileUpload(credentialId, e)}
                          disabled={uploadingDoc === credentialId}
                          data-testid={`file-upload-${req.credentialCode}`}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                          {uploadingDoc === credentialId ? (
                            <Loader2 size={24} className="animate-spin text-accent" />
                          ) : (
                            <UploadCloud size={24} className="text-text-secondary" />
                          )}
                          <div className="text-xs font-semibold text-text-primary">
                            {uploadingDoc === credentialId
                              ? "Encrypting and uploading..."
                              : "Choose File or Drag & Drop"}
                          </div>
                          <div className="text-[11px] text-text-secondary">
                            PDF, PNG, JPG (max 10MB)
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-surface-muted rounded-xl text-xs text-text-secondary italic">
                        Please save licence details in Step 3 before attaching supporting documents.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 5: Review & Submit */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="border-b border-border-strong pb-4">
              <h2 className="text-xl font-bold font-outfit text-primary">
                Step 5: Review & Submit
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Verify your submission summary. Submitting locks your drafts and delivers them to the Jesmond compliance verification queue.
              </p>
            </div>

            {/* Identity Summary */}
            <div className="bg-surface-muted p-4 rounded-xl border border-border-strong/60 space-y-2">
              <div className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Identity & Registration
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Entity Name</span>
                <span className="font-semibold text-text-primary">
                  {data.organizationName}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Category & Jurisdiction</span>
                <span className="font-semibold text-text-primary">
                  {data.businessCategory} ({data.state})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">ABN Status</span>
                <span
                  className={`font-semibold ${
                    data.abnStatus === "VERIFIED" ||
                    data.abnStatus === "EXEMPTION_APPROVED"
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  {data.abnStatus}
                </span>
              </div>
            </div>

            {/* Licences Summary Table */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Credential Requirements
              </div>
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {data.requirements.map((req) => (
                  <div
                    key={req.credentialCode}
                    className="p-3 bg-surface flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-text-primary">
                        {req.name}
                      </div>
                      <div className="text-text-secondary text-[11px]">
                        Licence:{" "}
                        {req.currentCredential?.licenceNumber || "Not entered"}
                        {req.currentCredential?.documents?.length
                          ? ` • ${req.currentCredential.documents.length} doc(s)`
                          : ""}
                      </div>
                    </div>
                    <div>
                      {req.isSatisfied ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle size={14} /> Ready
                        </span>
                      ) : req.isMandatory ? (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <AlertTriangle size={14} /> Incomplete
                        </span>
                      ) : (
                        <span className="text-text-secondary">Optional</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border-strong">
              <div className="text-xs text-text-secondary">
                Submitting will not interrupt your ongoing POS, retail catalog, bookings, or orders.
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                data-testid="submit-credentials-btn"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-md shadow-brand-navy/20"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                <span>Submit for Verification</span>
              </button>
            </div>
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="mt-8 pt-6 border-t border-border-strong/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
            disabled={currentStep === 1}
            data-testid="prev-step-btn"
            className="px-4 py-2 rounded-xl border border-border text-text-secondary font-medium text-xs hover:bg-surface-muted disabled:opacity-30 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep((p) => Math.min(5, p + 1))}
            disabled={currentStep === 5}
            data-testid="next-step-btn"
            className="px-4 py-2 rounded-xl bg-surface-muted hover:bg-border/60 text-primary font-semibold text-xs border border-border disabled:opacity-30 transition-colors flex items-center gap-1.5"
          >
            <span>Next</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
