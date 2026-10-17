"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/utils/api";
import { getAccessToken, getCurrentUser } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import {
  Loader2,
  UserCheck,
  Clock,
  Briefcase,
  AlertCircle,
  Calendar,
  CheckCircle,
  Shield,
  Mail,
  User,
  Plus,
  X,
  Phone,
} from "lucide-react";
import { canUseBusinessCapability } from "@/utils/capabilities";
import { useRouter } from "next/navigation";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  serviceAssignments?: Array<{
    id: string;
    service: {
      id: string;
      name: string;
      durationMins: number;
    };
  }>;
  workingHours?: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isWorking: boolean;
  }>;
}

interface BusinessService {
  id: string;
  name: string;
  durationMins: number;
}

interface WorkingHourEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_WORKING_HOURS: WorkingHourEntry[] = DAYS_OF_WEEK.map(
  (_, i) => ({
    dayOfWeek: i,
    startTime: "09:00",
    endTime: "17:00",
    isWorking: i >= 1 && i <= 5, // Mon–Fri default
  })
);

// ─── Add Staff Modal ─────────────────────────────────────────────────────────

interface AddStaffModalProps {
  onClose: () => void;
  onSuccess: () => void;
  availableServices: BusinessService[];
}

function AddStaffModal({ onClose, onSuccess, availableServices }: AddStaffModalProps) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHourEntry[]>(
    DEFAULT_WORKING_HOURS.map((wh) => ({ ...wh }))
  );
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Field-level validation ────────────────────────────────────────────────

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.firstName.trim()) errors.firstName = "First name is required.";
    if (!form.email.trim()) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "Please enter a valid email address.";
    }

    // Validate working hour consistency
    for (const wh of workingHours) {
      if (wh.isWorking) {
        const [sh, sm] = wh.startTime.split(":").map(Number);
        const [eh, em] = wh.endTime.split(":").map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        if (startMins >= endMins) {
          errors[`wh_${wh.dayOfWeek}`] = `${DAYS_OF_WEEK[wh.dayOfWeek]}: end time must be after start time.`;
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setServerError(null);

    try {
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/staff`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim() || undefined,
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            serviceIds: selectedServiceIds.length > 0 ? selectedServiceIds : undefined,
            workingHours,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data?.message ||
          (Array.isArray(data?.message) ? data.message[0] : null) ||
          "Failed to add staff member. Please try again.";
        throw new Error(Array.isArray(msg) ? msg[0] : msg);
      }

      setSuccess(true);
      // Slight delay so the user sees the success state, then close + refresh
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Service toggle ─────────────────────────────────────────────────────────

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // ── Working hour changes ───────────────────────────────────────────────────

  const updateHour = (
    dayOfWeek: number,
    field: keyof WorkingHourEntry,
    value: string | boolean
  ) => {
    setWorkingHours((prev) =>
      prev.map((wh) =>
        wh.dayOfWeek === dayOfWeek ? { ...wh, [field]: value } : wh
      )
    );
    // Clear error for this day when user edits
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`wh_${dayOfWeek}`];
      return next;
    });
  };

  // ── UI ─────────────────────────────────────────────────────────────────────

  const workingHoursErrors = Object.entries(fieldErrors).filter(([k]) =>
    k.startsWith("wh_")
  );

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Add Staff Member"
    >
      {/* Panel */}
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-surface rounded-2xl border border-border-strong shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-strong bg-surface-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <UserCheck size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="font-bold text-primary text-base">Add Staff Member</h2>
              <p className="text-xs text-text-secondary">
                Create or link an account and set qualifications
              </p>
            </div>
          </div>
          <button
            id="close-add-staff-modal"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg hover:bg-surface-muted transition-colors text-text-secondary"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form
          id="add-staff-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1"
          noValidate
        >
          <div className="px-6 py-5 space-y-6">
            {/* Success State */}
            {success && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                <CheckCircle size={18} className="shrink-0" />
                Staff member added successfully! Refreshing roster…
              </div>
            )}

            {/* Server Error */}
            {serverError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            {/* ── Personal Details ──────────────────────────────────── */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                <User size={13} /> Personal Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label
                    htmlFor="staff-first-name"
                    className="block text-sm font-medium text-primary mb-1"
                  >
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="staff-first-name"
                    type="text"
                    value={form.firstName}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, firstName: e.target.value }));
                      setFieldErrors((fe) => { const n = { ...fe }; delete n.firstName; return n; });
                    }}
                    placeholder="Jane"
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-surface text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition ${fieldErrors.firstName ? "border-red-400" : "border-border-strong"}`}
                    disabled={saving || success}
                    autoComplete="given-name"
                  />
                  {fieldErrors.firstName && (
                    <p className="mt-1 text-xs text-red-500">{fieldErrors.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label
                    htmlFor="staff-last-name"
                    className="block text-sm font-medium text-primary mb-1"
                  >
                    Last Name
                  </label>
                  <input
                    id="staff-last-name"
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Smith"
                    className="w-full px-3 py-2.5 rounded-xl border border-border-strong text-sm bg-surface text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                    disabled={saving || success}
                    autoComplete="family-name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="staff-email"
                    className="block text-sm font-medium text-primary mb-1"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      id="staff-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, email: e.target.value }));
                        setFieldErrors((fe) => { const n = { ...fe }; delete n.email; return n; });
                        setServerError(null);
                      }}
                      placeholder="jane@example.com"
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm bg-surface text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition ${fieldErrors.email ? "border-red-400" : "border-border-strong"}`}
                      disabled={saving || success}
                      autoComplete="email"
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>
                  )}
                  <p className="mt-1 text-[11px] text-text-muted">
                    If this email already exists, the user will be linked to your organization.
                  </p>
                </div>

                {/* Phone */}
                <div>
                  <label
                    htmlFor="staff-phone"
                    className="block text-sm font-medium text-primary mb-1"
                  >
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      id="staff-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+61 4xx xxx xxx"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border-strong text-sm bg-surface text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                      disabled={saving || success}
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── Service Qualifications ────────────────────────────── */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                <Briefcase size={13} /> Qualified Services
                <span className="text-text-muted font-normal normal-case">(optional)</span>
              </h3>
              {availableServices.length === 0 ? (
                <p className="text-sm text-text-muted italic p-3 bg-surface-muted rounded-xl">
                  No services defined yet — add services first under the Services tab.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableServices.map((svc) => {
                    const selected = selectedServiceIds.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        id={`service-toggle-${svc.id}`}
                        onClick={() => toggleService(svc.id)}
                        disabled={saving || success}
                        className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                          selected
                            ? "bg-accent/10 border-accent text-primary"
                            : "bg-surface-muted/40 border-border-strong text-text-secondary hover:border-accent/50"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold">{svc.name}</div>
                          <div className="text-[11px] flex items-center gap-1 mt-0.5 opacity-75">
                            <Clock size={11} /> {svc.durationMins} min
                          </div>
                        </div>
                        {selected && (
                          <CheckCircle size={16} className="text-accent shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Weekly Working Hours ──────────────────────────────── */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                <Clock size={13} /> Weekly Working Hours
                <span className="text-text-muted font-normal normal-case">(optional)</span>
              </h3>

              {workingHoursErrors.length > 0 && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 space-y-0.5">
                  {workingHoursErrors.map(([k, v]) => (
                    <div key={k}>{v}</div>
                  ))}
                </div>
              )}

              <div className="divide-y divide-border-strong/50 border border-border-strong rounded-xl overflow-hidden">
                {workingHours.map((wh) => (
                  <div
                    key={wh.dayOfWeek}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      wh.isWorking ? "bg-surface" : "bg-surface-muted/30"
                    }`}
                  >
                    {/* Day toggle */}
                    <label className="flex items-center gap-2 w-28 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id={`wh-toggle-${wh.dayOfWeek}`}
                        checked={wh.isWorking}
                        onChange={(e) => updateHour(wh.dayOfWeek, "isWorking", e.target.checked)}
                        disabled={saving || success}
                        className="w-4 h-4 accent-accent rounded"
                      />
                      <span className={`font-semibold ${wh.isWorking ? "text-primary" : "text-text-muted"}`}>
                        {DAYS_OF_WEEK[wh.dayOfWeek]}
                      </span>
                    </label>

                    {wh.isWorking ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          id={`wh-start-${wh.dayOfWeek}`}
                          type="time"
                          value={wh.startTime}
                          onChange={(e) => updateHour(wh.dayOfWeek, "startTime", e.target.value)}
                          disabled={saving || success}
                          className="px-2 py-1 rounded-lg border border-border-strong text-xs text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        <span className="text-text-muted text-xs">–</span>
                        <input
                          id={`wh-end-${wh.dayOfWeek}`}
                          type="time"
                          value={wh.endTime}
                          onChange={(e) => updateHour(wh.dayOfWeek, "endTime", e.target.value)}
                          disabled={saving || success}
                          className="px-2 py-1 rounded-lg border border-border-strong text-xs text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        <span className="ml-auto shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                          Working
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted italic">Off Duty</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-border-strong bg-surface-muted/40 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 shrink-0">
            <button
              id="cancel-add-staff"
              type="button"
              onClick={onClose}
              disabled={saving || success}
              className="px-5 py-2.5 rounded-xl border border-border-strong text-sm font-medium text-primary bg-surface hover:bg-surface-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="submit-add-staff"
              type="submit"
              disabled={saving || success}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-60 flex items-center gap-2 justify-center"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Saving…
                </>
              ) : success ? (
                <>
                  <CheckCircle size={15} /> Added!
                </>
              ) : (
                <>
                  <Plus size={15} /> Add Staff Member
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BusinessStaffPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [availableServices, setAvailableServices] = useState<BusinessService[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/staff`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch staff members and professionals");
      const data = await res.json();
      setStaffList(data);
      if (data.length > 0) {
        setSelectedStaff((prev) => {
          // Keep selection if still in list, else default to first
          const stillExists = prev ? data.find((m: StaffMember) => m.id === prev.id) : null;
          return stillExists || data[0];
        });
      } else {
        setSelectedStaff(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/services`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setAvailableServices(
        (data as any[]).filter((s) => s.isActive !== false).map((s) => ({
          id: s.id,
          name: s.name,
          durationMins: s.durationMins,
        }))
      );
    } catch {
      // Non-critical — services just won't be preloaded in the modal
    }
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (
      !user ||
      !canUseBusinessCapability(user.businessCategory as any, "APPOINTMENT_STAFF")
    ) {
      router.replace("/portal");
      return;
    }
    fetchStaff();
    fetchServices();
  }, [router, fetchStaff, fetchServices]);

  const handleStaffAdded = useCallback(() => {
    fetchStaff();
  }, [fetchStaff]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff & Professionals"
        description="Manage your organisation's qualified professionals, their service assignments, and weekly working hours."
        primaryAction={{
          label: "+ Add Staff",
          href: "#",
          onClick: () => setShowAddModal(true),
        }}
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      ) : staffList.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border-strong rounded-2xl text-text-secondary">
          <UserCheck size={40} className="mx-auto mb-3 opacity-60" />
          <h4 className="font-bold text-primary mb-1">No staff members found</h4>
          <p className="text-xs text-text-muted mb-6">
            Add your first professional to start assigning services and managing appointments.
          </p>
          <button
            id="empty-state-add-staff"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            <Plus size={15} /> Add First Staff Member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Staff List Roster */}
          <div className="lg:col-span-1 bg-surface rounded-2xl border border-border-strong overflow-hidden shadow-sm flex flex-col">
            <div className="px-6 py-4 border-b border-border-strong bg-surface-muted/50 flex items-center justify-between">
              <h3 className="font-bold text-primary text-sm flex items-center gap-2">
                <User size={16} className="text-accent" />
                Professionals Roster ({staffList.length})
              </h3>
              <button
                id="roster-add-staff-btn"
                onClick={() => setShowAddModal(true)}
                title="Add Staff Member"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
              >
                <Plus size={13} /> Add
              </button>
            </div>
            <div className="divide-y divide-border-strong overflow-y-auto max-h-[600px]">
              {staffList.map((member) => {
                const isSelected = selectedStaff?.id === member.id;
                const assignedCount = member.serviceAssignments?.length || 0;
                return (
                  <button
                    key={member.id}
                    id={`staff-roster-item-${member.id}`}
                    onClick={() => setSelectedStaff(member)}
                    className={`w-full text-left p-4 transition-colors flex items-start justify-between gap-3 ${
                      isSelected
                        ? "bg-accent/10 border-l-4 border-accent"
                        : "hover:bg-surface-muted/40"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-primary text-sm">
                        {member.user.firstName} {member.user.lastName}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-1.5">
                        <Mail size={12} /> {member.user.email}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-muted text-text-secondary border border-border-strong/50">
                          {member.role.replace("_", " ")}
                        </span>
                        <span className="text-[11px] text-accent font-semibold">
                          {assignedCount}{" "}
                          {assignedCount === 1 ? "service" : "services"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Profile, Qualified Services & Working Hours */}
          {selectedStaff && (
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Card */}
              <div className="bg-surface rounded-2xl border border-border-strong p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-strong">
                  <div>
                    <h3 className="text-xl font-bold text-primary">
                      {selectedStaff.user.firstName}{" "}
                      {selectedStaff.user.lastName}
                    </h3>
                    <div className="text-xs text-text-secondary mt-1 flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Mail size={13} /> {selectedStaff.user.email}
                      </span>
                      {selectedStaff.user.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={13} /> {selectedStaff.user.phone}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700">
                        {selectedStaff.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Qualified Service Assignments */}
                <div className="mt-6">
                  <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Briefcase size={16} className="text-accent" />
                    Qualified Service Offerings (
                    {selectedStaff.serviceAssignments?.length || 0})
                  </h4>
                  {!selectedStaff.serviceAssignments ||
                  selectedStaff.serviceAssignments.length === 0 ? (
                    <div className="p-4 bg-surface-muted rounded-xl text-xs text-text-secondary italic">
                      This professional is not currently assigned to any specific services.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedStaff.serviceAssignments.map((asgn) => (
                        <div
                          key={asgn.id}
                          className="p-3 bg-surface-muted/60 border border-border-strong/60 rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-primary text-sm">
                              {asgn.service.name}
                            </div>
                            <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                              <Clock size={12} /> {asgn.service.durationMins} min
                            </div>
                          </div>
                          <CheckCircle size={16} className="text-green-600 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weekly Working Hours */}
                <div className="mt-8">
                  <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock size={16} className="text-accent" />
                    Weekly Availability & Working Hours
                  </h4>
                  {!selectedStaff.workingHours ||
                  selectedStaff.workingHours.length === 0 ? (
                    <div className="p-4 bg-surface-muted rounded-xl text-xs text-text-secondary">
                      Standard business hours apply (Monday – Friday, 09:00 – 17:00).
                    </div>
                  ) : (
                    <div className="divide-y divide-border-strong/50 border border-border-strong rounded-xl overflow-hidden">
                      {DAYS_OF_WEEK.map((dayName, dayIndex) => {
                        const wh = selectedStaff.workingHours?.find(
                          (w) => w.dayOfWeek === dayIndex
                        );
                        const isWorking = wh
                          ? wh.isWorking
                          : dayIndex >= 1 && dayIndex <= 5;
                        const start = wh?.startTime || "09:00";
                        const end = wh?.endTime || "17:00";

                        return (
                          <div
                            key={dayName}
                            className="px-4 py-2.5 flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-primary w-28">
                              {dayName}
                            </span>
                            <div className="flex items-center gap-3">
                              {isWorking ? (
                                <span className="font-medium text-text-secondary">
                                  {start} – {end}
                                </span>
                              ) : (
                                <span className="text-text-muted italic">Off Duty</span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isWorking
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {isWorking ? "Working" : "Closed"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <AddStaffModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleStaffAdded}
          availableServices={availableServices}
        />
      )}
    </div>
  );
}
