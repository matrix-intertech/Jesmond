"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth, buildAuthHeaders, hasBrowserAuth } from "@/utils/auth";
import { getApiUrl, handleApiError } from '@/utils/api';
import { Bell, Mail, ShieldAlert, CheckCircle2, AlertCircle, Lock } from "lucide-react";

interface PreferenceItem {
  category: "APPOINTMENT_TRANSACTIONAL" | "APPOINTMENT_REMINDERS" | "SYSTEM_SECURITY";
  channel: "EMAIL" | "IN_APP";
  enabled: boolean;
}

export default function NotificationSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [preferences, setPreferences] = useState<PreferenceItem[]>([
    { category: "APPOINTMENT_TRANSACTIONAL", channel: "EMAIL", enabled: true },
    { category: "APPOINTMENT_TRANSACTIONAL", channel: "IN_APP", enabled: true },
    { category: "APPOINTMENT_REMINDERS", channel: "EMAIL", enabled: true },
    { category: "APPOINTMENT_REMINDERS", channel: "IN_APP", enabled: true },
    { category: "SYSTEM_SECURITY", channel: "EMAIL", enabled: true },
    { category: "SYSTEM_SECURITY", channel: "IN_APP", enabled: true },
  ]);

  const apiBase = getApiUrl();

  useEffect(() => {
    const fetchPreferences = async () => {
      const token = getAccessToken();
      if (!hasBrowserAuth()) return;

      try {
        const res = await fetch(`${apiBase}/api/v1/notification-preferences`, {
          headers: buildAuthHeaders(),
        });

        const status = await handleApiError(res, () => {
          clearAuth();
          router.replace("/login");
        });

        if (status === "ok") {
          const json = await res.json();
          if (json.preferences && Array.isArray(json.preferences)) {
            setPreferences(json.preferences);
          }
        } else {
          setError("Failed to load notification preferences");
        }
      } catch (e: any) {
        setError(e.message || "Failed to load preferences");
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [router, apiBase]);

  const isEnabled = (category: PreferenceItem["category"], channel: PreferenceItem["channel"]) => {
    const found = preferences.find((p) => p.category === category && p.channel === channel);
    return found ? found.enabled : true;
  };

  const handleToggle = (
    category: PreferenceItem["category"],
    channel: PreferenceItem["channel"],
    val: boolean,
  ) => {
    if (category === "SYSTEM_SECURITY") return; // Security cannot be toggled

    setPreferences((prev) => {
      const exists = prev.some((p) => p.category === category && p.channel === channel);
      if (exists) {
        return prev.map((p) =>
          p.category === category && p.channel === channel ? { ...p, enabled: val } : p,
        );
      }
      return [...prev, { category, channel, enabled: val }];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const token = getAccessToken();
      const res = await fetch(`${apiBase}/api/v1/notification-preferences`, {
        method: "PATCH",
        headers: buildAuthHeaders({ "Content-Type": "application/json", }),
        body: JSON.stringify({ preferences }),
      });

      if (res.ok) {
        setSuccess("Notification preferences saved successfully.");
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || "Failed to update notification preferences.");
      }
    } catch (e: any) {
      setError(e.message || "Network connection error.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-text-secondary text-sm">
        Loading preferences...
      </div>
    );
  }

  return (
    <div className="bg-surface shadow-sm rounded-xl border border-border overflow-hidden">
      <div className="px-6 py-5 border-b border-border bg-surface-muted/30">
        <h3 className="text-lg font-semibold text-text-primary">Notification Preferences</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Control how and when you receive appointment updates and notifications.
        </p>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Appointment Reminders */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h4 className="text-sm font-semibold text-text-primary">Appointment Reminders</h4>
            </div>
            <p className="text-xs text-text-secondary">
              Reminders sent 24 hours and 1 hour prior to your confirmed appointments.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <label className="flex items-start justify-between p-3.5 rounded-lg border border-border hover:bg-surface-muted/30 cursor-pointer transition">
                <div className="pr-4">
                  <span className="text-sm font-medium text-text-primary block">Email Reminders</span>
                  <span className="text-xs text-text-secondary block mt-0.5">
                    Receive 24h and 1h reminders in your inbox
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled("APPOINTMENT_REMINDERS", "EMAIL")}
                  onChange={(e) => handleToggle("APPOINTMENT_REMINDERS", "EMAIL", e.target.checked)}
                  className="h-4 w-4 text-accent focus:ring-primary border-border rounded mt-1"
                />
              </label>

              <label className="flex items-start justify-between p-3.5 rounded-lg border border-border hover:bg-surface-muted/30 cursor-pointer transition">
                <div className="pr-4">
                  <span className="text-sm font-medium text-text-primary block">In-App Reminders</span>
                  <span className="text-xs text-text-secondary block mt-0.5">
                    Show reminders in the portal notification bell
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled("APPOINTMENT_REMINDERS", "IN_APP")}
                  onChange={(e) => handleToggle("APPOINTMENT_REMINDERS", "IN_APP", e.target.checked)}
                  className="h-4 w-4 text-accent focus:ring-primary border-border rounded mt-1"
                />
              </label>
            </div>
          </div>

          {/* Section 2: Appointment Transactional Updates */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <h4 className="text-sm font-semibold text-text-primary">Appointment Status Updates</h4>
            </div>
            <p className="text-xs text-text-secondary">
              Notifications when appointments are requested, confirmed, rescheduled, or cancelled.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <label className="flex items-start justify-between p-3.5 rounded-lg border border-border hover:bg-surface-muted/30 cursor-pointer transition">
                <div className="pr-4">
                  <span className="text-sm font-medium text-text-primary block">Email Updates</span>
                  <span className="text-xs text-text-secondary block mt-0.5">
                    Confirmation and rescheduling emails
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled("APPOINTMENT_TRANSACTIONAL", "EMAIL")}
                  onChange={(e) => handleToggle("APPOINTMENT_TRANSACTIONAL", "EMAIL", e.target.checked)}
                  className="h-4 w-4 text-accent focus:ring-primary border-border rounded mt-1"
                />
              </label>

              <label className="flex items-start justify-between p-3.5 rounded-lg border border-border hover:bg-surface-muted/30 cursor-pointer transition">
                <div className="pr-4">
                  <span className="text-sm font-medium text-text-primary block">In-App Notifications</span>
                  <span className="text-xs text-text-secondary block mt-0.5">
                    Alerts in your notification bell
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled("APPOINTMENT_TRANSACTIONAL", "IN_APP")}
                  onChange={(e) => handleToggle("APPOINTMENT_TRANSACTIONAL", "IN_APP", e.target.checked)}
                  className="h-4 w-4 text-accent focus:ring-primary border-border rounded mt-1"
                />
              </label>
            </div>
          </div>

          {/* Section 3: System Security (Mandatory) */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h4 className="text-sm font-semibold text-text-primary">System & Security Alerts</h4>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                <Lock size={10} /> Mandatory
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Login codes, password resets, and account security notices cannot be disabled.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start justify-between p-3.5 rounded-lg border border-border bg-surface-muted/40 opacity-80 cursor-not-allowed">
                <div className="pr-4">
                  <span className="text-sm font-medium text-text-primary block">Security Emails</span>
                  <span className="text-xs text-text-secondary block mt-0.5">
                    Authentication OTPs and password reset links
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="h-4 w-4 text-accent/60 cursor-not-allowed rounded mt-1"
                />
              </div>

              <div className="flex items-start justify-between p-3.5 rounded-lg border border-border bg-surface-muted/40 opacity-80 cursor-not-allowed">
                <div className="pr-4">
                  <span className="text-sm font-medium text-text-primary block">In-App Security Alerts</span>
                  <span className="text-xs text-text-secondary block mt-0.5">
                    Account access and security warnings
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="h-4 w-4 text-accent/60 cursor-not-allowed rounded mt-1"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-border">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex justify-center items-center py-2.5 px-5 border border-transparent text-sm font-semibold rounded-lg text-white bg-accent hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition shadow-sm"
            >
              {submitting ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
