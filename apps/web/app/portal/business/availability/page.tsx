"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/utils/api";
import { getAccessToken, getCurrentUser } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import {
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  AlertCircle,
  CheckCircle,
  X,
  Trash2,
  Edit2,
  User,
  Shield,
  Briefcase,
  Coffee,
  CalendarOff,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
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
  };
  serviceAssignments?: Array<{
    service: {
      id: string;
      name: string;
      durationMins: number;
    };
  }>;
}

interface TimeOffBlock {
  id: string;
  staffId: string;
  organizationId: string;
  startTime: string;
  endTime: string;
  timezone: string;
  type: "LEAVE" | "BREAK" | "OFFLINE_WORK" | "COMMITMENT" | "OTHER";
  reason?: string;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "CUSTOM";
  recurrenceEnd?: string;
  staff: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

interface ServiceItem {
  id: string;
  name: string;
  durationMins: number;
  price: number;
  branchId: string;
}

export default function BusinessAvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [timeOffBlocks, setTimeOffBlocks] = useState<TimeOffBlock[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  // Filters & Views
  const [viewMode, setViewMode] = useState<"CALENDAR" | "LIST">("CALENDAR");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("ALL");
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);

  // Time Off Modal state
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimeOffBlock | null>(null);
  const [timeOffSubmitting, setTimeOffSubmitting] = useState(false);
  const [timeOffModalError, setTimeOffModalError] = useState<string | null>(null);

  const [timeOffFormData, setTimeOffFormData] = useState({
    staffId: "",
    type: "BREAK" as "LEAVE" | "BREAK" | "OFFLINE_WORK" | "COMMITMENT" | "OTHER",
    startDate: new Date().toISOString().split("T")[0],
    startTime: "12:00",
    endDate: new Date().toISOString().split("T")[0],
    endTime: "13:00",
    reason: "",
    recurrence: "NONE" as "NONE" | "DAILY" | "WEEKLY" | "CUSTOM",
    recurrenceEnd: "",
  });

  // Offline Appointment Modal state (Workflow B)
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [offlineSubmitting, setOfflineSubmitting] = useState(false);
  const [offlineModalError, setOfflineModalError] = useState<string | null>(null);

  const [offlineFormData, setOfflineFormData] = useState({
    staffId: "",
    serviceId: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "10:00",
    endTime: "11:00",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    notes: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();

      const [staffRes, blocksRes, servicesRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/v1/business-appointments/staff`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiUrl()}/api/v1/business-appointments/time-off`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiUrl()}/api/v1/business-appointments/services`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!staffRes.ok) throw new Error("Failed to load staff list");
      if (!blocksRes.ok) throw new Error("Failed to load time off blocks");
      if (!servicesRes.ok) throw new Error("Failed to load services catalogue");

      const staffData = await staffRes.json();
      const blocksData = await blocksRes.json();
      const servicesData = await servicesRes.json();

      setStaffList(staffData);
      setTimeOffBlocks(blocksData);
      setServices(servicesData);

      if (staffData.length > 0 && !timeOffFormData.staffId) {
        setTimeOffFormData((prev) => ({ ...prev, staffId: staffData[0].id }));
        setOfflineFormData((prev) => ({
          ...prev,
          staffId: staffData[0].id,
          serviceId: servicesData[0]?.id || "",
        }));
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
      !canUseBusinessCapability(user.businessCategory as any, "APPOINTMENT_STAFF")
    ) {
      router.replace("/portal");
      return;
    }
    fetchData();
  }, [router]);

  // Handle open create Time Off
  const handleOpenCreateTimeOff = (preselectedStaffId?: string, dateStr?: string) => {
    setEditingBlock(null);
    setTimeOffModalError(null);
    const dateVal = dateStr || new Date().toISOString().split("T")[0];
    setTimeOffFormData({
      staffId: preselectedStaffId || staffList[0]?.id || "",
      type: "BREAK",
      startDate: dateVal,
      startTime: "12:00",
      endDate: dateVal,
      endTime: "13:00",
      reason: "",
      recurrence: "NONE",
      recurrenceEnd: "",
    });
    setIsTimeOffModalOpen(true);
  };

  // Handle open edit Time Off
  const handleOpenEditTimeOff = (block: TimeOffBlock) => {
    setEditingBlock(block);
    setTimeOffModalError(null);
    const sDate = new Date(block.startTime);
    const eDate = new Date(block.endTime);
    setTimeOffFormData({
      staffId: block.staffId,
      type: block.type,
      startDate: sDate.toISOString().split("T")[0],
      startTime: sDate.toISOString().substring(11, 16),
      endDate: eDate.toISOString().split("T")[0],
      endTime: eDate.toISOString().substring(11, 16),
      reason: block.reason || "",
      recurrence: block.recurrence || "NONE",
      recurrenceEnd: block.recurrenceEnd ? block.recurrenceEnd.split("T")[0] : "",
    });
    setIsTimeOffModalOpen(true);
  };

  // Submit Time Off (Create or Update)
  const handleTimeOffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTimeOffSubmitting(true);
      setTimeOffModalError(null);
      const token = getAccessToken();

      const startUtc = new Date(`${timeOffFormData.startDate}T${timeOffFormData.startTime}:00Z`).toISOString();
      const endUtc = new Date(`${timeOffFormData.endDate}T${timeOffFormData.endTime}:00Z`).toISOString();

      if (new Date(startUtc) >= new Date(endUtc)) {
        throw new Error("Start time must be before end time");
      }

      const payload = {
        staffId: timeOffFormData.staffId,
        startTime: startUtc,
        endTime: endUtc,
        type: timeOffFormData.type,
        reason: timeOffFormData.reason || undefined,
        recurrence: timeOffFormData.recurrence,
        recurrenceEnd: timeOffFormData.recurrenceEnd
          ? new Date(`${timeOffFormData.recurrenceEnd}T23:59:59Z`).toISOString()
          : undefined,
      };

      const url = editingBlock
        ? `${getApiUrl()}/api/v1/business-appointments/time-off/${editingBlock.id}`
        : `${getApiUrl()}/api/v1/business-appointments/time-off`;
      const method = editingBlock ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to save time off block");
      }

      setIsTimeOffModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setTimeOffModalError(err.message);
    } finally {
      setTimeOffSubmitting(false);
    }
  };

  // Delete Time Off
  const handleDeleteTimeOff = async (block: TimeOffBlock) => {
    if (!confirm(`Are you sure you want to cancel and remove this ${block.type.toLowerCase()} block?`)) {
      return;
    }

    try {
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/time-off/${block.id}/delete`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to remove time off block");
      }

      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Offline Appointment
  const handleOfflineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setOfflineSubmitting(true);
      setOfflineModalError(null);
      const token = getAccessToken();

      const selectedSvc = services.find((s) => s.id === offlineFormData.serviceId);
      if (!selectedSvc) throw new Error("Please select a bookable service");

      const startUtc = new Date(`${offlineFormData.date}T${offlineFormData.startTime}:00Z`).toISOString();
      const endUtc = new Date(`${offlineFormData.date}T${offlineFormData.endTime}:00Z`).toISOString();

      if (new Date(startUtc) >= new Date(endUtc)) {
        throw new Error("Start time must be before end time");
      }

      const payload = {
        branchId: selectedSvc.branchId,
        serviceId: offlineFormData.serviceId,
        staffId: offlineFormData.staffId,
        startTime: startUtc,
        endTime: endUtc,
        customerName: offlineFormData.customerName.trim() || undefined,
        customerPhone: offlineFormData.customerPhone.trim() || undefined,
        customerEmail: offlineFormData.customerEmail.trim() || undefined,
        notes: offlineFormData.notes.trim() || undefined,
      };

      const res = await fetch(`${getApiUrl()}/api/v1/business-appointments/offline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to record offline appointment");
      }

      setIsOfflineModalOpen(false);
      alert("Offline appointment confirmed and added to calendar!");
      await fetchData();
    } catch (err: any) {
      setOfflineModalError(err.message);
    } finally {
      setOfflineSubmitting(false);
    }
  };

  // Filtered blocks
  const filteredBlocks = timeOffBlocks.filter((b) => {
    if (selectedStaffFilter === "ALL") return true;
    return b.staffId === selectedStaffFilter;
  });

  // Calculate current week days for calendar view
  const getWeekDates = (offset: number) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + offset * 7); // Monday start

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDates(currentWeekOffset);

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "BREAK":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "LEAVE":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "OFFLINE_WORK":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "COMMITMENT":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "BREAK":
        return <Coffee size={12} />;
      case "LEAVE":
        return <CalendarOff size={12} />;
      case "OFFLINE_WORK":
        return <Briefcase size={12} />;
      default:
        return <Clock size={12} />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Availability & Time Off"
          description="Manage professional schedules, time-off blocks, breaks, leave, and offline appointments."
        />
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setIsOfflineModalOpen(true);
              setOfflineModalError(null);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-surface border border-border-strong text-text-primary text-sm font-bold rounded-xl hover:bg-surface-muted transition-colors shadow-sm"
          >
            <Briefcase size={17} className="text-accent" />
            Record Offline Work
          </button>
          <button
            onClick={() => handleOpenCreateTimeOff()}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-navy text-white text-sm font-bold rounded-xl hover:bg-brand-navy/90 shadow-sm transition-colors"
          >
            <Plus size={18} />
            Block Time Off
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Control Bar: Professional Filter & View Switcher */}
      <div className="bg-surface rounded-2xl border border-border-strong p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Professional Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 shrink-0">
            <User size={14} className="text-accent" /> Professional:
          </span>
          <button
            onClick={() => setSelectedStaffFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors ${
              selectedStaffFilter === "ALL"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface-muted border border-border-strong text-text-secondary hover:text-primary"
            }`}
          >
            All Staff ({staffList.length})
          </button>
          {staffList.map((s) => {
            const count = timeOffBlocks.filter((b) => b.staffId === s.id).length;
            const isSelected = selectedStaffFilter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedStaffFilter(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-accent text-white shadow-sm"
                    : "bg-surface-muted border border-border-strong text-text-secondary hover:text-primary"
                }`}
              >
                <span>{s.user.firstName} {s.user.lastName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-black/5 text-text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle & Calendar Controls */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {viewMode === "CALENDAR" && (
            <div className="flex items-center gap-1 bg-surface-muted border border-border-strong rounded-xl p-1 mr-2">
              <button
                onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
                className="p-1 rounded hover:bg-black/5 text-text-secondary hover:text-primary"
                title="Previous Week"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentWeekOffset(0)}
                className="px-2 py-0.5 text-xs font-bold text-text-secondary hover:text-primary"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
                className="p-1 rounded hover:bg-black/5 text-text-secondary hover:text-primary"
                title="Next Week"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div className="flex rounded-xl border border-border-strong bg-surface-muted p-1">
            <button
              onClick={() => setViewMode("CALENDAR")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                viewMode === "CALENDAR"
                  ? "bg-white text-primary shadow-sm"
                  : "text-text-secondary hover:text-primary"
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode("LIST")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                viewMode === "LIST"
                  ? "bg-white text-primary shadow-sm"
                  : "text-text-secondary hover:text-primary"
              }`}
            >
              List ({filteredBlocks.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      ) : viewMode === "CALENDAR" ? (
        /* CALENDAR VIEW */
        <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-border-strong bg-surface-muted text-center py-3">
            {weekDays.map((date, idx) => {
              const isToday =
                date.toISOString().split("T")[0] ===
                new Date().toISOString().split("T")[0];
              return (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-[11px] font-bold text-text-secondary uppercase">
                    {date.toLocaleDateString("en-AU", { weekday: "short" })}
                  </span>
                  <span
                    className={`text-sm font-bold mt-0.5 px-2 py-0.5 rounded-full ${
                      isToday ? "bg-accent text-white" : "text-primary"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 min-h-[420px] divide-x divide-border-strong/60">
            {weekDays.map((date, idx) => {
              const dateStr = date.toISOString().split("T")[0];
              const dayBlocks = filteredBlocks.filter((b) => {
                const bStart = b.startTime.split("T")[0];
                const bEnd = b.endTime.split("T")[0];
                return dateStr >= bStart && dateStr <= bEnd;
              });

              return (
                <div key={idx} className="p-2 flex flex-col gap-2 relative group hover:bg-surface-muted/30 transition-colors">
                  <button
                    onClick={() => handleOpenCreateTimeOff(selectedStaffFilter !== "ALL" ? selectedStaffFilter : undefined, dateStr)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1 p-1 bg-white border border-border-strong rounded-md text-text-secondary hover:text-accent shadow-xs"
                    title="Block time on this date"
                  >
                    <Plus size={12} />
                  </button>

                  {dayBlocks.length === 0 ? (
                    <span className="text-[10px] text-text-muted text-center pt-8 opacity-40">
                      No blocks
                    </span>
                  ) : (
                    dayBlocks.map((block) => (
                      <div
                        key={block.id}
                        onClick={() => handleOpenEditTimeOff(block)}
                        className={`p-2 rounded-xl border text-xs cursor-pointer hover:shadow-xs transition-shadow flex flex-col justify-between ${getTypeBadgeColor(
                          block.type,
                        )}`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="font-bold text-[11px] flex items-center gap-1">
                            {getTypeIcon(block.type)} {block.type.replace("_", " ")}
                          </span>
                          <span className="text-[10px] opacity-75">
                            {block.startTime.substring(11, 16)} - {block.endTime.substring(11, 16)}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold truncate">
                          {block.staff.user.firstName} {block.staff.user.lastName}
                        </div>
                        {block.reason && (
                          <div className="text-[10px] opacity-80 truncate mt-0.5">
                            {block.reason}
                          </div>
                        )}
                        {block.recurrence !== "NONE" && (
                          <div className="text-[9px] font-bold uppercase tracking-wider opacity-75 mt-1">
                            ↻ {block.recurrence}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="flex flex-col gap-3">
          {filteredBlocks.length === 0 ? (
            <div className="p-12 text-center bg-surface border border-border-strong rounded-2xl text-text-secondary">
              <CalendarOff size={40} className="mx-auto mb-3 opacity-60" />
              <h4 className="font-bold text-primary mb-1">No time off or availability blocks</h4>
              <p className="text-xs text-text-muted mb-4">
                Schedule breaks, offline tasks, leave, or block unavailability for your professionals.
              </p>
              <button
                onClick={() => handleOpenCreateTimeOff()}
                className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl"
              >
                Create Time Off Block
              </button>
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden shadow-sm">
              <div className="divide-y divide-border-strong/60">
                {filteredBlocks.map((block) => {
                  const s = new Date(block.startTime);
                  const e = new Date(block.endTime);
                  return (
                    <div
                      key={block.id}
                      className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-muted/40 transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`p-2.5 rounded-xl border ${getTypeBadgeColor(block.type)} shrink-0`}>
                          {getTypeIcon(block.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-base text-primary">
                              {block.staff.user.firstName} {block.staff.user.lastName}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getTypeBadgeColor(
                                block.type,
                              )}`}
                            >
                              {block.type.replace("_", " ")}
                            </span>
                            {block.recurrence !== "NONE" && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-muted border border-border-strong text-text-secondary">
                                Recurring: {block.recurrence}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-text-secondary">
                            <span className="flex items-center gap-1 font-medium">
                              <CalendarIcon size={13} className="text-accent" />
                              {s.toLocaleDateString("en-AU", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            <span className="flex items-center gap-1 font-medium">
                              <Clock size={13} className="text-accent" />
                              {s.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })} -{" "}
                              {e.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {block.reason && (
                            <p className="text-xs text-text-muted mt-1.5 italic">
                              "{block.reason}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                          onClick={() => handleOpenEditTimeOff(block)}
                          className="p-2 text-text-secondary hover:text-primary rounded-xl border border-border-strong hover:bg-surface-muted transition-colors text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTimeOff(block)}
                          className="p-2 text-rose-600 hover:text-rose-700 rounded-xl border border-rose-200 hover:bg-rose-50 transition-colors text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT TIME OFF MODAL (Workflow A) */}
      {isTimeOffModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold text-primary mb-1">
              {editingBlock ? "Edit Time Off Block" : "Block Unavailability / Time Off"}
            </h2>
            <p className="text-xs text-text-secondary mb-5">
              Prevent public bookings for this professional during breaks, offline duties, or leave.
            </p>

            {timeOffModalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} />
                {timeOffModalError}
              </div>
            )}

            <form onSubmit={handleTimeOffSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Professional *
                </label>
                <select
                  disabled={!!editingBlock}
                  value={timeOffFormData.staffId}
                  onChange={(e) =>
                    setTimeOffFormData({ ...timeOffFormData, staffId: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.user.firstName} {s.user.lastName} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Reason Category *
                </label>
                <select
                  value={timeOffFormData.type}
                  onChange={(e) =>
                    setTimeOffFormData({
                      ...timeOffFormData,
                      type: e.target.value as any,
                    })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
                >
                  <option value="BREAK">Break / Meal Break</option>
                  <option value="LEAVE">Leave (Sick, Annual, Personal)</option>
                  <option value="OFFLINE_WORK">Offline Work / Non-Appointment Job</option>
                  <option value="COMMITMENT">External Commitment</option>
                  <option value="OTHER">Other Unavailability</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Start Date & Time *
                  </label>
                  <input
                    type="date"
                    required
                    value={timeOffFormData.startDate}
                    onChange={(e) =>
                      setTimeOffFormData({ ...timeOffFormData, startDate: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm mb-2"
                  />
                  <input
                    type="time"
                    required
                    value={timeOffFormData.startTime}
                    onChange={(e) =>
                      setTimeOffFormData({ ...timeOffFormData, startTime: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    End Date & Time *
                  </label>
                  <input
                    type="date"
                    required
                    value={timeOffFormData.endDate}
                    onChange={(e) =>
                      setTimeOffFormData({ ...timeOffFormData, endDate: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm mb-2"
                  />
                  <input
                    type="time"
                    required
                    value={timeOffFormData.endTime}
                    onChange={(e) =>
                      setTimeOffFormData({ ...timeOffFormData, endTime: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Recurrence
                </label>
                <select
                  value={timeOffFormData.recurrence}
                  onChange={(e) =>
                    setTimeOffFormData({
                      ...timeOffFormData,
                      recurrence: e.target.value as any,
                    })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
                >
                  <option value="NONE">One-time block only</option>
                  <option value="DAILY">Repeat Daily</option>
                  <option value="WEEKLY">Repeat Weekly on this day</option>
                </select>
              </div>

              {timeOffFormData.recurrence !== "NONE" && (
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Recurrence End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={timeOffFormData.recurrenceEnd}
                    onChange={(e) =>
                      setTimeOffFormData({
                        ...timeOffFormData,
                        recurrenceEnd: e.target.value,
                      })
                    }
                    className="w-full p-3 rounded-xl border border-border-strong text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Notes / Reason Details
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Workshop maintenance, scheduled doctor appointment..."
                  value={timeOffFormData.reason}
                  onChange={(e) =>
                    setTimeOffFormData({ ...timeOffFormData, reason: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-border-strong">
                <button
                  type="button"
                  onClick={() => setIsTimeOffModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-strong text-text-secondary hover:text-primary text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={timeOffSubmitting}
                  className="px-6 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-bold hover:bg-brand-navy/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {timeOffSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {editingBlock ? "Save Changes" : "Create Block"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD OFFLINE APPOINTMENT MODAL (Workflow B) */}
      {isOfflineModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold text-primary mb-1">
              Record Offline Appointment
            </h2>
            <p className="text-xs text-text-secondary mb-5">
              Enter walk-in, phone, or external bookings directly confirmed into the schedule.
            </p>

            {offlineModalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} />
                {offlineModalError}
              </div>
            )}

            <form onSubmit={handleOfflineSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Service *
                </label>
                <select
                  required
                  value={offlineFormData.serviceId}
                  onChange={(e) => {
                    const svc = services.find((s) => s.id === e.target.value);
                    setOfflineFormData({
                      ...offlineFormData,
                      serviceId: e.target.value,
                    });
                  }}
                  className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
                >
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} ({svc.durationMins} mins, AUD ${(svc.price / 100).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Assigned Professional *
                </label>
                <select
                  required
                  value={offlineFormData.staffId}
                  onChange={(e) =>
                    setOfflineFormData({ ...offlineFormData, staffId: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.user.firstName} {s.user.lastName} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={offlineFormData.date}
                    onChange={(e) =>
                      setOfflineFormData({ ...offlineFormData, date: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={offlineFormData.startTime}
                    onChange={(e) =>
                      setOfflineFormData({ ...offlineFormData, startTime: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={offlineFormData.endTime}
                    onChange={(e) =>
                      setOfflineFormData({ ...offlineFormData, endTime: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Walk-in Customer"
                    value={offlineFormData.customerName}
                    onChange={(e) =>
                      setOfflineFormData({ ...offlineFormData, customerName: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-border-strong text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Customer Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0412 345 678"
                    value={offlineFormData.customerPhone}
                    onChange={(e) =>
                      setOfflineFormData({ ...offlineFormData, customerPhone: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-border-strong text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Customer Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="Optional customer email"
                  value={offlineFormData.customerEmail}
                  onChange={(e) =>
                    setOfflineFormData({ ...offlineFormData, customerEmail: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Job Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Offline booking notes or job instructions..."
                  value={offlineFormData.notes}
                  onChange={(e) =>
                    setOfflineFormData({ ...offlineFormData, notes: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-border-strong">
                <button
                  type="button"
                  onClick={() => setIsOfflineModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-strong text-text-secondary hover:text-primary text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={offlineSubmitting}
                  className="px-6 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-bold hover:bg-brand-navy/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {offlineSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Confirm Offline Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
