"use client";

import { useState } from "react";
import { getApiUrl } from "@/utils/api";
import { getAccessToken } from "@/utils/auth";
import {
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Briefcase,
  User,
} from "lucide-react";

interface WorkingHourEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

interface BusinessService {
  id: string;
  name: string;
  durationMins: number;
}

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
    id?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isWorking?: boolean;
  }>;
}

interface EditStaffScheduleModalProps {
  staff: StaffMember;
  availableServices: BusinessService[];
  onClose: () => void;
  onSuccess: () => void;
}

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function EditStaffScheduleModal({
  staff,
  availableServices,
  onClose,
  onSuccess,
}: EditStaffScheduleModalProps) {
  // Prepopulate hours
  const initialHours: WorkingHourEntry[] = DAYS_OF_WEEK.map((_, dayIndex) => {
    const existing = staff.workingHours?.find((w) => w.dayOfWeek === dayIndex);
    if (existing) {
      return {
        dayOfWeek: dayIndex,
        startTime: existing.startTime || "09:00",
        endTime: existing.endTime || "17:00",
        isWorking: existing.isWorking !== undefined ? existing.isWorking : true,
      };
    }
    return {
      dayOfWeek: dayIndex,
      startTime: "09:00",
      endTime: "17:00",
      isWorking: false,
    };
  });

  const initialServiceIds =
    staff.serviceAssignments?.map((a) => a.service.id) || [];

  const [workingHours, setWorkingHours] = useState<WorkingHourEntry[]>(initialHours);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(initialServiceIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    for (const wh of workingHours) {
      if (wh.isWorking) {
        const [sH, sM] = wh.startTime.split(":").map(Number);
        const [eH, eM] = wh.endTime.split(":").map(Number);
        if (sH * 60 + sM >= eH * 60 + eM) {
          setError(
            `${DAYS_OF_WEEK[wh.dayOfWeek]}: End time must be after start time.`
          );
          return;
        }
      }
    }

    try {
      setSaving(true);
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/staff/${staff.id}/working-hours`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            workingHours,
            serviceIds: selectedServiceIds,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update staff schedule");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit Staff Schedule"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-surface rounded-2xl border border-border-strong shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-strong bg-surface-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Clock size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="font-bold text-primary text-base">
                Edit Schedule — {staff.user.firstName} {staff.user.lastName}
              </h2>
              <p className="text-xs text-text-secondary">
                Configure weekly working days, shift hours, and service offerings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg hover:bg-surface-muted transition-colors text-text-secondary"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">
          {success && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              <CheckCircle size={18} className="shrink-0" />
              Schedule updated successfully!
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Qualified Services */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
              <Briefcase size={13} /> Qualified Services
            </h3>
            {availableServices.length === 0 ? (
              <p className="text-xs text-text-muted italic p-3 bg-surface-muted rounded-xl">
                No services available.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableServices.map((svc) => {
                  const selected = selectedServiceIds.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleService(svc.id)}
                      disabled={saving}
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

          {/* Weekly Working Hours */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
              <Clock size={13} /> Weekly Working Hours
            </h3>
            <div className="divide-y divide-border-strong/50 border border-border-strong rounded-xl overflow-hidden">
              {workingHours.map((wh) => (
                <div
                  key={wh.dayOfWeek}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    wh.isWorking ? "bg-surface" : "bg-surface-muted/30"
                  }`}
                >
                  <label className="flex items-center gap-2 w-28 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={wh.isWorking}
                      onChange={(e) =>
                        updateHour(wh.dayOfWeek, "isWorking", e.target.checked)
                      }
                      disabled={saving}
                      className="w-4 h-4 accent-accent rounded"
                    />
                    <span
                      className={`font-semibold ${
                        wh.isWorking ? "text-primary" : "text-text-muted"
                      }`}
                    >
                      {DAYS_OF_WEEK[wh.dayOfWeek]}
                    </span>
                  </label>

                  {wh.isWorking ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="time"
                        value={wh.startTime}
                        onChange={(e) =>
                          updateHour(wh.dayOfWeek, "startTime", e.target.value)
                        }
                        disabled={saving}
                        className="px-2 py-1 rounded-lg border border-border-strong text-xs text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                      <span className="text-text-muted text-xs">–</span>
                      <input
                        type="time"
                        value={wh.endTime}
                        onChange={(e) =>
                          updateHour(wh.dayOfWeek, "endTime", e.target.value)
                        }
                        disabled={saving}
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

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-border-strong flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-border-strong text-sm font-medium text-primary bg-surface hover:bg-surface-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || success}
              className="px-5 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Saving…
                </>
              ) : (
                "Save Schedule"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
