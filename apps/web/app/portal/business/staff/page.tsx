"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { canUseBusinessCapability } from "@/utils/capabilities";
import { useRouter } from "next/navigation";

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
      durationMinutes: number;
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

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function BusinessStaffPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Selected staff member for detailed view
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/staff`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok)
        throw new Error("Failed to fetch staff members and professionals");
      const data = await res.json();
      setStaffList(data);
      if (data.length > 0) {
        setSelectedStaff(data[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (
      !user ||
      !canUseBusinessCapability(
        user.businessCategory as any,
        "APPOINTMENT_STAFF",
      )
    ) {
      router.replace("/portal");
      return;
    }
    fetchStaff();
  }, [router]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff & Professionals"
        description="View your organization's qualified professionals, their service assignments, and weekly working hours."
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
          <h4 className="font-bold text-primary mb-1">
            No staff members found
          </h4>
          <p className="text-xs text-text-muted">
            Add organization staff in Settings to assign appointment services.
          </p>
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
            </div>
            <div className="divide-y divide-border-strong overflow-y-auto max-h-[600px]">
              {staffList.map((member) => {
                const isSelected = selectedStaff?.id === member.id;
                const assignedCount = member.serviceAssignments?.length || 0;
                return (
                  <button
                    key={member.id}
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
                        <span>Phone: {selectedStaff.user.phone}</span>
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
                      This professional is not currently assigned to any
                      specific services.
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
                              <Clock size={12} /> {asgn.service.durationMinutes}{" "}
                              min
                            </div>
                          </div>
                          <CheckCircle
                            size={16}
                            className="text-green-600 shrink-0"
                          />
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
                      Standard business hours apply (Monday – Friday, 09:00 –
                      17:00).
                    </div>
                  ) : (
                    <div className="divide-y divide-border-strong/50 border border-border-strong rounded-xl overflow-hidden">
                      {DAYS_OF_WEEK.map((dayName, dayIndex) => {
                        const wh = selectedStaff.workingHours?.find(
                          (w) => w.dayOfWeek === dayIndex,
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
                                <span className="text-text-muted italic">
                                  Off Duty
                                </span>
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
    </div>
  );
}
