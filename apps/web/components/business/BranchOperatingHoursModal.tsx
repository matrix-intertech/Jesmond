"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/utils/api";
import { getAccessToken } from "@/utils/auth";
import {
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

interface Period {
  openTime: string;
  closeTime: string;
}

interface OperatingHoursDay {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  periods?: Period[];
}

interface BranchOperatingHoursModalProps {
  branchId: string;
  onClose: () => void;
  onSuccess?: () => void;
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

const DEFAULT_HOURS: OperatingHoursDay[] = DAYS_OF_WEEK.map((_, i) => ({
  dayOfWeek: i,
  isOpen: i >= 1 && i <= 5, // Mon–Fri open by default
  openTime: "09:00",
  closeTime: "17:00",
}));

export default function BranchOperatingHoursModal({
  branchId,
  onClose,
  onSuccess,
}: BranchOperatingHoursModalProps) {
  const [hours, setHours] = useState<OperatingHoursDay[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadHours() {
      try {
        setLoading(true);
        setError(null);
        const token = getAccessToken();
        const res = await fetch(
          `${getApiUrl()}/api/v1/business-appointments/branches/${branchId}/operating-hours`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error("Failed to load branch operating hours");
        const data = await res.json();
        if (Array.isArray(data.operatingHours) && data.operatingHours.length > 0) {
          // Merge with all 7 days
          const merged = DEFAULT_HOURS.map((def) => {
            const found = data.operatingHours.find(
              (h: any) => h.dayOfWeek === def.dayOfWeek
            );
            return found
              ? {
                  dayOfWeek: def.dayOfWeek,
                  isOpen: Boolean(found.isOpen),
                  openTime: found.openTime || "09:00",
                  closeTime: found.closeTime || "17:00",
                  periods: found.periods || [],
                }
              : def;
          });
          setHours(merged);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (branchId) {
      loadHours();
    }
  }, [branchId]);

  const updateDay = (dayOfWeek: number, field: string, value: any) => {
    setHours((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d))
    );
  };

  const addPeriod = (dayOfWeek: number) => {
    setHours((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const periods = d.periods ? [...d.periods] : [];
        periods.push({ openTime: "14:00", closeTime: "18:00" });
        return { ...d, periods };
      })
    );
  };

  const removePeriod = (dayOfWeek: number, index: number) => {
    setHours((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek || !d.periods) return d;
        const periods = d.periods.filter((_, idx) => idx !== index);
        return { ...d, periods };
      })
    );
  };

  const updatePeriod = (
    dayOfWeek: number,
    index: number,
    field: "openTime" | "closeTime",
    value: string
  ) => {
    setHours((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek || !d.periods) return d;
        const periods = d.periods.map((p, idx) =>
          idx === index ? { ...p, [field]: value } : p
        );
        return { ...d, periods };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation: ensure for all open days, closeTime > openTime
    for (const d of hours) {
      if (d.isOpen) {
        const [oH, oM] = d.openTime.split(":").map(Number);
        const [cH, cM] = d.closeTime.split(":").map(Number);
        if (oH * 60 + oM >= cH * 60 + cM) {
          setError(
            `${DAYS_OF_WEEK[d.dayOfWeek]}: Closing time must be later than opening time.`
          );
          return;
        }
        if (d.periods) {
          for (const p of d.periods) {
            const [poH, poM] = p.openTime.split(":").map(Number);
            const [pcH, pcM] = p.closeTime.split(":").map(Number);
            if (poH * 60 + poM >= pcH * 60 + pcM) {
              setError(
                `${DAYS_OF_WEEK[d.dayOfWeek]}: Split shift closing time must be later than opening time.`
              );
              return;
            }
          }
        }
      }
    }

    try {
      setSaving(true);
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/branches/${branchId}/operating-hours`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ operatingHours: hours }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to save operating hours");
      }

      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
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
      aria-label="Branch Operating Hours"
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
                Branch Operating Hours
              </h2>
              <p className="text-xs text-text-secondary">
                Configure opening and closing schedules for this workshop / branch
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
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-accent" size={32} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
            {success && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                <CheckCircle size={18} className="shrink-0" />
                Operating hours updated successfully!
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="divide-y divide-border-strong/50 border border-border-strong rounded-xl overflow-hidden">
              {hours.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className={`p-4 text-sm transition-colors ${
                    day.isOpen ? "bg-surface" : "bg-surface-muted/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 w-32 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={day.isOpen}
                        onChange={(e) =>
                          updateDay(day.dayOfWeek, "isOpen", e.target.checked)
                        }
                        disabled={saving}
                        className="w-4 h-4 accent-accent rounded"
                      />
                      <span
                        className={`font-semibold ${
                          day.isOpen ? "text-primary" : "text-text-muted"
                        }`}
                      >
                        {DAYS_OF_WEEK[day.dayOfWeek]}
                      </span>
                    </label>

                    {day.isOpen ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="time"
                          value={day.openTime}
                          onChange={(e) =>
                            updateDay(day.dayOfWeek, "openTime", e.target.value)
                          }
                          disabled={saving}
                          className="px-2.5 py-1.5 rounded-lg border border-border-strong text-xs text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        <span className="text-text-muted text-xs">to</span>
                        <input
                          type="time"
                          value={day.closeTime}
                          onChange={(e) =>
                            updateDay(day.dayOfWeek, "closeTime", e.target.value)
                          }
                          disabled={saving}
                          className="px-2.5 py-1.5 rounded-lg border border-border-strong text-xs text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        <button
                          type="button"
                          onClick={() => addPeriod(day.dayOfWeek)}
                          className="text-[11px] text-accent hover:underline flex items-center gap-1 font-semibold ml-2"
                        >
                          <Plus size={12} /> Split Shift
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted italic">Closed</span>
                    )}
                  </div>

                  {/* Split Shift Periods if any */}
                  {day.isOpen && day.periods && day.periods.length > 0 && (
                    <div className="mt-3 pl-8 space-y-2">
                      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                        Additional Shift Period:
                      </p>
                      {day.periods.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={p.openTime}
                            onChange={(e) =>
                              updatePeriod(
                                day.dayOfWeek,
                                idx,
                                "openTime",
                                e.target.value
                              )
                            }
                            disabled={saving}
                            className="px-2.5 py-1.5 rounded-lg border border-border-strong text-xs text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                          <span className="text-text-muted text-xs">to</span>
                          <input
                            type="time"
                            value={p.closeTime}
                            onChange={(e) =>
                              updatePeriod(
                                day.dayOfWeek,
                                idx,
                                "closeTime",
                                e.target.value
                              )
                            }
                            disabled={saving}
                            className="px-2.5 py-1.5 rounded-lg border border-border-strong text-xs text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                          <button
                            type="button"
                            onClick={() => removePeriod(day.dayOfWeek, idx)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Remove period"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

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
                  "Save Operating Hours"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
