"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/utils/api";
import { getAccessToken, getCurrentUser, getDashboardRouteForUser } from "@/utils/auth";
import { formatAudPrice } from "@/utils/pricing";
import {
  formatLocalDate,
  getItemDateString,
  getItemTimeString,
  formatDisplayDate,
} from "@/utils/datetime";
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
  Eye,
  ExternalLink,
} from "lucide-react";
import { canUseBusinessCapability } from "@/utils/capabilities";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

interface BusinessAppointment {
  id: string;
  organizationId: string;
  branchId: string;
  staffId: string | null;
  serviceId: string;
  serviceName: string;
  durationMins: number;
  price: number;
  currency: string;
  status: "PENDING_APPROVAL" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "REJECTED";
  startTime: string;
  endTime: string;
  timezone: string;
  customerNotes?: string | null;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  } | null;
  staff?: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  } | null;
  service?: {
    id: string;
    name: string;
    durationMins: number;
    price: number;
  } | null;
  branch?: {
    id: string;
    name: string;
  } | null;
}

export default function BusinessAvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [timeOffBlocks, setTimeOffBlocks] = useState<TimeOffBlock[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [appointments, setAppointments] = useState<BusinessAppointment[]>([]);

  // Filters & Views
  const [viewMode, setViewMode] = useState<"CALENDAR" | "LIST">("CALENDAR");
  const [listTypeFilter, setListTypeFilter] = useState<"ALL" | "APPOINTMENTS" | "TIME_OFF">("ALL");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("ALL");
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);

  // Time Off Modal state (Workflow A)
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimeOffBlock | null>(null);
  const [timeOffSubmitting, setTimeOffSubmitting] = useState(false);
  const [timeOffModalError, setTimeOffModalError] = useState<string | null>(null);

  const [timeOffFormData, setTimeOffFormData] = useState({
    staffId: "",
    type: "BREAK" as "LEAVE" | "BREAK" | "OFFLINE_WORK" | "COMMITMENT" | "OTHER",
    startDate: formatLocalDate(new Date()),
    startTime: "12:00",
    endDate: formatLocalDate(new Date()),
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
    date: formatLocalDate(new Date()),
    startTime: "10:00",
    endTime: "11:00",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    notes: "",
  });

  // View appointment details state
  const [viewingAppointment, setViewingAppointment] = useState<BusinessAppointment | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();

      const [staffRes, blocksRes, servicesRes, apptsRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/v1/business-appointments/staff`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiUrl()}/api/v1/business-appointments/time-off`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiUrl()}/api/v1/business-appointments/services`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiUrl()}/api/v1/business-appointments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!staffRes.ok) throw new Error("Failed to load staff list");
      if (!blocksRes.ok) throw new Error("Failed to load time off blocks");
      if (!servicesRes.ok) throw new Error("Failed to load services catalogue");
      if (!apptsRes.ok) throw new Error("Failed to load business appointments");

      const staffData = await staffRes.json();
      const blocksData = await blocksRes.json();
      const servicesData = await servicesRes.json();
      const apptsData = await apptsRes.json();

      setStaffList(staffData);
      setTimeOffBlocks(blocksData);
      setServices(servicesData);
      setAppointments(apptsData);

      // Auto-populate form selections if unselected
      if (staffData.length > 0) {
        setTimeOffFormData((prev) => ({
          ...prev,
          staffId: prev.staffId || staffData[0].id,
        }));
        setOfflineFormData((prev) => ({
          ...prev,
          staffId: prev.staffId || staffData[0].id,
          serviceId: prev.serviceId || (servicesData[0]?.id || ""),
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
      user &&
      !canUseBusinessCapability(user.businessCategory as any, "APPOINTMENT_STAFF")
    ) {
      router.replace(getDashboardRouteForUser(user));
      return;
    }
    fetchData();
  }, [router]);

  // Handle open create Time Off
  const handleOpenCreateTimeOff = (preselectedStaffId?: string, dateStr?: string) => {
    setEditingBlock(null);
    setTimeOffModalError(null);
    const dateVal = dateStr || formatLocalDate(new Date());
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
    const startDate = getItemDateString(block.startTime);
    const startTime = getItemTimeString(block.startTime);
    const endDate = getItemDateString(block.endTime);
    const endTime = getItemTimeString(block.endTime);

    setTimeOffFormData({
      staffId: block.staffId,
      type: block.type,
      startDate,
      startTime,
      endDate,
      endTime,
      reason: block.reason || "",
      recurrence: block.recurrence || "NONE",
      recurrenceEnd: block.recurrenceEnd ? getItemDateString(block.recurrenceEnd) : "",
    });
    setIsTimeOffModalOpen(true);
  };

  // Submit Time Off (Create or Update)
  const handleTimeOffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timeOffSubmitting) return;

    try {
      setTimeOffSubmitting(true);
      setTimeOffModalError(null);
      const token = getAccessToken();

      const startUtc = new Date(`${timeOffFormData.startDate}T${timeOffFormData.startTime}:00Z`).toISOString();
      const endUtc = new Date(`${timeOffFormData.endDate}T${timeOffFormData.endTime}:00Z`).toISOString();

      if (new Date(startUtc) >= new Date(endUtc)) {
        throw new Error("Start time must be strictly before end time");
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
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to save time off block");
      }

      setIsTimeOffModalOpen(false);
      setSuccessMessage(editingBlock ? "Time off block updated successfully." : "Time off block created successfully.");
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
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to remove time off block");
      }

      setSuccessMessage("Time off block removed successfully.");
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Open Offline Appointment Modal
  const handleOpenOfflineModal = (preselectedDate?: string) => {
    setOfflineModalError(null);
    const dateVal = preselectedDate || formatLocalDate(new Date());

    const activeService = services.find((s) => s.id === offlineFormData.serviceId) || services[0];
    const duration = activeService?.durationMins || 60;
    const startH = 10;
    const startM = 0;
    const totalEndMins = startH * 60 + startM + duration;
    const endH = String(Math.floor(totalEndMins / 60) % 24).padStart(2, "0");
    const endM = String(totalEndMins % 60).padStart(2, "0");

    setOfflineFormData((prev) => ({
      ...prev,
      date: dateVal,
      serviceId: prev.serviceId || activeService?.id || "",
      staffId: prev.staffId || staffList[0]?.id || "",
      startTime: "10:00",
      endTime: `${endH}:${endM}`,
    }));
    setIsOfflineModalOpen(true);
  };

  // Submit Offline Appointment (Workflow B)
  const handleOfflineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (offlineSubmitting) return;

    try {
      setOfflineSubmitting(true);
      setOfflineModalError(null);
      const token = getAccessToken();

      if (!offlineFormData.serviceId) {
        throw new Error("Please select a bookable service");
      }
      const selectedSvc = services.find((s) => s.id === offlineFormData.serviceId);
      if (!selectedSvc) throw new Error("Please select a bookable service");

      if (!offlineFormData.staffId) {
        throw new Error("Please select an assigned professional");
      }

      if (!offlineFormData.date) {
        throw new Error("Please select a date");
      }

      if (!offlineFormData.startTime || !offlineFormData.endTime) {
        throw new Error("Please specify start and end times");
      }

      const startUtc = new Date(`${offlineFormData.date}T${offlineFormData.startTime}:00Z`).toISOString();
      const endUtc = new Date(`${offlineFormData.date}T${offlineFormData.endTime}:00Z`).toISOString();

      if (new Date(startUtc) >= new Date(endUtc)) {
        throw new Error("Start time must be strictly before end time");
      }

      const payload = {
        branchId: selectedSvc.branchId,
        serviceId: offlineFormData.serviceId,
        staffId: offlineFormData.staffId,
        startTime: startUtc,
        endTime: endUtc,
        timezone: "Australia/Sydney",
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
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to record offline appointment");
      }

      setIsOfflineModalOpen(false);

      // Ensure calendar view navigates to the week of the created appointment
      const [y, m, d] = offlineFormData.date.split("-").map(Number);
      const targetDate = new Date(y, m - 1, d);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayOfWeek = today.getDay();
      const distToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + distToMonday);
      const diffWeeks = Math.floor((targetDate.getTime() - thisMonday.getTime()) / (7 * 86400000));
      setCurrentWeekOffset(diffWeeks);

      setSuccessMessage("Offline appointment recorded and added to calendar successfully!");

      // Reset form customer fields
      setOfflineFormData((prev) => ({
        ...prev,
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        notes: "",
      }));

      // Immediately refresh both time-offs and appointments
      await fetchData();
    } catch (err: any) {
      setOfflineModalError(err.message);
    } finally {
      setOfflineSubmitting(false);
    }
  };

  // Filtered blocks and appointments
  const filteredBlocks = timeOffBlocks.filter((b) => {
    if (selectedStaffFilter === "ALL") return true;
    return b.staffId === selectedStaffFilter;
  });

  const filteredAppointments = appointments.filter((a) => {
    // Exclude cancelled and rejected appointments from active availability schedule
    if (a.status === "REJECTED" || a.status === "CANCELLED") return false;
    if (selectedStaffFilter !== "ALL" && a.staffId !== selectedStaffFilter) return false;
    return true;
  });

  // Calculate current week days for calendar view (Monday to Sunday)
  const getWeekDates = (offset: number) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay();
    const distToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + distToMonday + offset * 7);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
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
            data-testid="record-offline-work-btn"
            onClick={() => handleOpenOfflineModal()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-surface border border-border-strong text-text-primary text-sm font-bold rounded-xl hover:bg-surface-muted transition-colors shadow-sm"
          >
            <Briefcase size={17} className="text-accent" />
            Record Offline Work
          </button>
          <button
            data-testid="block-time-off-btn"
            onClick={() => handleOpenCreateTimeOff()}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-navy text-white text-sm font-bold rounded-xl hover:bg-brand-navy/90 shadow-sm transition-colors"
          >
            <Plus size={18} />
            Block Time Off
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-md"
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Control Bar: Professional Filter & View Switcher */}
      <div className="bg-surface rounded-2xl border border-border-strong p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        {/* Professional Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 shrink-0">
            <User size={14} className="text-accent" /> Professional:
          </span>
          <button
            data-testid="filter-all-staff"
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
            const blockCount = timeOffBlocks.filter((b) => b.staffId === s.id).length;
            const apptCount = appointments.filter(
              (a) => a.staffId === s.id && a.status !== "CANCELLED" && a.status !== "REJECTED",
            ).length;
            const count = blockCount + apptCount;
            const isSelected = selectedStaffFilter === s.id;
            return (
              <button
                key={s.id}
                data-testid={`filter-staff-${s.id}`}
                onClick={() => setSelectedStaffFilter(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-accent text-white shadow-sm"
                    : "bg-surface-muted border border-border-strong text-text-secondary hover:text-primary"
                }`}
              >
                <span>
                  {s.user.firstName} {s.user.lastName}
                </span>
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
                data-testid="prev-week-btn"
                onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
                className="p-1 rounded hover:bg-black/5 text-text-secondary hover:text-primary"
                title="Previous Week"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                data-testid="today-btn"
                onClick={() => setCurrentWeekOffset(0)}
                className="px-2 py-0.5 text-xs font-bold text-text-secondary hover:text-primary"
              >
                Today
              </button>
              <button
                data-testid="next-week-btn"
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
              data-testid="view-calendar-tab"
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
              data-testid="view-list-tab"
              onClick={() => setViewMode("LIST")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                viewMode === "LIST"
                  ? "bg-white text-primary shadow-sm"
                  : "text-text-secondary hover:text-primary"
              }`}
            >
              List ({filteredBlocks.length + filteredAppointments.length})
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
          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b border-border-strong bg-surface-muted text-center py-3">
            {weekDays.map((date, idx) => {
              const isToday = formatLocalDate(date) === formatLocalDate(new Date());
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

          {/* Weekday Columns */}
          <div className="grid grid-cols-7 min-h-[440px] divide-x divide-border-strong/60">
            {weekDays.map((date, idx) => {
              const dateStr = formatLocalDate(date);

              // 1. Time off blocks for this day
              const dayBlocks = filteredBlocks.filter((b) => {
                const bStart = getItemDateString(b.startTime);
                const bEnd = getItemDateString(b.endTime);
                return dateStr >= bStart && dateStr <= bEnd;
              });

              // 2. Appointments for this day
              const dayAppts = filteredAppointments.filter((a) => {
                const aDate = getItemDateString(a.startTime);
                return aDate === dateStr;
              });

              // Combine and sort by start time
              type ScheduleItem =
                | { kind: "BLOCK"; data: TimeOffBlock; timeStr: string }
                | { kind: "APPT"; data: BusinessAppointment; timeStr: string };

              const combinedItems: ScheduleItem[] = [
                ...dayBlocks.map((b) => ({
                  kind: "BLOCK" as const,
                  data: b,
                  timeStr: getItemTimeString(b.startTime),
                })),
                ...dayAppts.map((a) => ({
                  kind: "APPT" as const,
                  data: a,
                  timeStr: getItemTimeString(a.startTime),
                })),
              ].sort((a, b) => a.timeStr.localeCompare(b.timeStr));

              return (
                <div
                  key={idx}
                  data-testid={`calendar-day-column-${dateStr}`}
                  className="p-2 flex flex-col gap-2 relative group hover:bg-surface-muted/30 transition-colors min-h-[140px]"
                >
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1 z-10">
                    <button
                      onClick={() => handleOpenOfflineModal(dateStr)}
                      className="p-1 bg-white border border-border-strong rounded-md text-text-secondary hover:text-accent shadow-xs"
                      title="Record offline work on this date"
                    >
                      <Briefcase size={12} />
                    </button>
                    <button
                      onClick={() =>
                        handleOpenCreateTimeOff(
                          selectedStaffFilter !== "ALL" ? selectedStaffFilter : undefined,
                          dateStr,
                        )
                      }
                      className="p-1 bg-white border border-border-strong rounded-md text-text-secondary hover:text-accent shadow-xs"
                      title="Block time on this date"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {combinedItems.length === 0 ? (
                    <span className="text-[10px] text-text-muted text-center pt-8 opacity-40">
                      No entries
                    </span>
                  ) : (
                    combinedItems.map((item) => {
                      if (item.kind === "BLOCK") {
                        const block = item.data;
                        const sTime = getItemTimeString(block.startTime);
                        const eTime = getItemTimeString(block.endTime);
                        return (
                          <div
                            key={`block-${block.id}`}
                            data-testid="calendar-timeoff-card"
                            onClick={() => handleOpenEditTimeOff(block)}
                            className={`p-2 rounded-xl border text-xs cursor-pointer hover:shadow-xs transition-shadow flex flex-col justify-between ${getTypeBadgeColor(
                              block.type,
                            )}`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="font-bold text-[11px] flex items-center gap-1">
                                {getTypeIcon(block.type)} {block.type.replace("_", " ")}
                              </span>
                              <span className="text-[10px] opacity-75 font-mono">
                                {sTime} - {eTime}
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
                        );
                      } else {
                        const appt = item.data;
                        const sTime = getItemTimeString(appt.startTime);
                        const eTime = getItemTimeString(appt.endTime);
                        const isOffline = appt.customerNotes?.includes("[Offline Booking]") || false;
                        const customerName = appt.customer
                          ? `${appt.customer.firstName} ${appt.customer.lastName}`
                          : appt.customerNotes?.replace("[Offline Booking]", "").trim() || "Walk-in";

                        return (
                          <div
                            key={`appt-${appt.id}`}
                            data-testid="calendar-appointment-card"
                            onClick={() => setViewingAppointment(appt)}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer hover:shadow-md transition-all flex flex-col justify-between ${
                              isOffline
                                ? "bg-blue-50/90 border-blue-200 text-blue-950"
                                : "bg-emerald-50/90 border-emerald-200 text-emerald-950"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span
                                className={`font-bold text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wider ${
                                  isOffline
                                    ? "bg-blue-200/70 text-blue-900"
                                    : "bg-emerald-200/70 text-emerald-900"
                                }`}
                              >
                                {isOffline ? <Briefcase size={10} /> : <CalendarIcon size={10} />}
                                {isOffline ? "Offline Work" : "Appointment"}
                              </span>
                              <span className="text-[10px] font-mono font-bold opacity-80">
                                {sTime} - {eTime}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold truncate text-primary">
                              {appt.serviceName || appt.service?.name}
                            </div>
                            <div className="text-[10px] text-text-secondary truncate mt-0.5">
                              {appt.staff?.user
                                ? `${appt.staff.user.firstName} ${appt.staff.user.lastName}`
                                : "Assigned Professional"}
                            </div>
                            <div className="text-[10px] text-text-muted truncate mt-0.5 font-medium">
                              Cust: {customerName}
                            </div>
                            <div className="mt-1.5 pt-1 border-t border-black/5 flex items-center justify-between text-[10px]">
                              <span className="font-semibold px-1 py-0.2 rounded bg-black/5 text-[9px]">
                                {appt.status}
                              </span>
                              <span className="font-bold text-accent">
                                {formatAudPrice(appt.price)}
                              </span>
                            </div>
                          </div>
                        );
                      }
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="flex flex-col gap-4">
          {/* Subfilter Bar */}
          <div className="flex items-center gap-2 border-b border-border-strong pb-2">
            <button
              data-testid="list-filter-all"
              onClick={() => setListTypeFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                listTypeFilter === "ALL"
                  ? "bg-primary text-white"
                  : "bg-surface-muted text-text-secondary hover:text-primary"
              }`}
            >
              All Entries ({filteredBlocks.length + filteredAppointments.length})
            </button>
            <button
              data-testid="list-filter-appointments"
              onClick={() => setListTypeFilter("APPOINTMENTS")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                listTypeFilter === "APPOINTMENTS"
                  ? "bg-primary text-white"
                  : "bg-surface-muted text-text-secondary hover:text-primary"
              }`}
            >
              Appointments ({filteredAppointments.length})
            </button>
            <button
              data-testid="list-filter-timeoff"
              onClick={() => setListTypeFilter("TIME_OFF")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                listTypeFilter === "TIME_OFF"
                  ? "bg-primary text-white"
                  : "bg-surface-muted text-text-secondary hover:text-primary"
              }`}
            >
              Time Off Blocks ({filteredBlocks.length})
            </button>
          </div>

          {/* List Content */}
          {(() => {
            const showAppts = listTypeFilter === "ALL" || listTypeFilter === "APPOINTMENTS";
            const showBlocks = listTypeFilter === "ALL" || listTypeFilter === "TIME_OFF";

            const allListItems = [
              ...(showBlocks
                ? filteredBlocks.map((b) => ({
                    id: `block-${b.id}`,
                    kind: "BLOCK" as const,
                    sortTime: b.startTime,
                    block: b,
                  }))
                : []),
              ...(showAppts
                ? filteredAppointments.map((a) => ({
                    id: `appt-${a.id}`,
                    kind: "APPT" as const,
                    sortTime: a.startTime,
                    appt: a,
                  }))
                : []),
            ].sort((a, b) => b.sortTime.localeCompare(a.sortTime));

            if (allListItems.length === 0) {
              return (
                <div className="p-12 text-center bg-surface border border-border-strong rounded-2xl text-text-secondary">
                  <CalendarOff size={40} className="mx-auto mb-3 opacity-60" />
                  <h4 className="font-bold text-primary mb-1">No scheduled entries found</h4>
                  <p className="text-xs text-text-muted mb-4">
                    Record offline appointments or block time-off to populate the schedule.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => handleOpenOfflineModal()}
                      className="px-4 py-2 bg-surface border border-border-strong text-text-primary text-xs font-bold rounded-xl hover:bg-surface-muted"
                    >
                      Record Offline Work
                    </button>
                    <button
                      onClick={() => handleOpenCreateTimeOff()}
                      className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl"
                    >
                      Block Time Off
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden shadow-sm">
                <div className="divide-y divide-border-strong/60">
                  {allListItems.map((item) => {
                    if (item.kind === "BLOCK") {
                      const block = item.block;
                      const sTime = getItemTimeString(block.startTime);
                      const eTime = getItemTimeString(block.endTime);
                      const dateDisplay = formatDisplayDate(block.startTime);

                      return (
                        <div
                          key={item.id}
                          data-testid="list-timeoff-item"
                          className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-muted/40 transition-colors"
                        >
                          <div className="flex items-start gap-3.5">
                            <div
                              className={`p-2.5 rounded-xl border ${getTypeBadgeColor(
                                block.type,
                              )} shrink-0`}
                            >
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
                                  {dateDisplay}
                                </span>
                                <span className="flex items-center gap-1 font-medium font-mono">
                                  <Clock size={13} className="text-accent" />
                                  {sTime} - {eTime}
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
                    } else {
                      const appt = item.appt;
                      const sTime = getItemTimeString(appt.startTime);
                      const eTime = getItemTimeString(appt.endTime);
                      const dateDisplay = formatDisplayDate(appt.startTime);
                      const isOffline = appt.customerNotes?.includes("[Offline Booking]") || false;
                      const customerName = appt.customer
                        ? `${appt.customer.firstName} ${appt.customer.lastName}`
                        : appt.customerNotes?.replace("[Offline Booking]", "").trim() || "Walk-in";

                      return (
                        <div
                          key={item.id}
                          data-testid="list-appointment-item"
                          className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-muted/40 transition-colors"
                        >
                          <div className="flex items-start gap-3.5">
                            <div
                              className={`p-2.5 rounded-xl border shrink-0 ${
                                isOffline
                                  ? "bg-blue-100 text-blue-800 border-blue-200"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-200"
                              }`}
                            >
                              {isOffline ? <Briefcase size={16} /> : <CalendarIcon size={16} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-base text-primary">
                                  {appt.serviceName || appt.service?.name}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    isOffline
                                      ? "bg-blue-100 text-blue-800 border-blue-200"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  }`}
                                >
                                  {isOffline ? "Offline Work" : "Appointment"}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-muted border border-border-strong text-text-secondary">
                                  {appt.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                                <span className="flex items-center gap-1 font-semibold text-primary">
                                  <User size={13} className="text-accent" />
                                  {appt.staff?.user
                                    ? `${appt.staff.user.firstName} ${appt.staff.user.lastName}`
                                    : "Unassigned"}
                                </span>
                                <span className="flex items-center gap-1 font-medium">
                                  <CalendarIcon size={13} className="text-accent" />
                                  {dateDisplay}
                                </span>
                                <span className="flex items-center gap-1 font-medium font-mono">
                                  <Clock size={13} className="text-accent" />
                                  {sTime} - {eTime}
                                </span>
                                <span className="font-semibold text-accent">
                                  {formatAudPrice(appt.price)}
                                </span>
                              </div>
                              <div className="text-xs text-text-muted mt-1.5 flex items-center gap-2">
                                <span>Customer: <strong className="text-text-secondary">{customerName}</strong></span>
                                {appt.customer?.phone && <span>• {appt.customer.phone}</span>}
                                {appt.customer?.email && <span>• {appt.customer.email}</span>}
                              </div>
                              {appt.customerNotes && (
                                <p className="text-xs text-text-muted mt-1 italic">
                                  "{appt.customerNotes}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-auto">
                            <button
                              onClick={() => setViewingAppointment(appt)}
                              className="p-2 text-text-secondary hover:text-primary rounded-xl border border-border-strong hover:bg-surface-muted transition-colors text-xs font-semibold flex items-center gap-1.5"
                            >
                              <Eye size={14} /> Details
                            </button>
                            <Link
                              href={`/portal/business/appointments?id=${appt.id}`}
                              className="p-2 text-accent hover:text-accent/80 rounded-xl border border-border-strong hover:bg-surface-muted transition-colors text-xs font-semibold flex items-center gap-1.5"
                            >
                              <ExternalLink size={14} /> Manage
                            </Link>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* CREATE / EDIT TIME OFF MODAL (Workflow A) */}
      {isTimeOffModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface rounded-3xl w-full max-w-lg shadow-2xl border border-border-strong flex flex-col max-h-[90vh] my-auto overflow-hidden">
            <div className="shrink-0 p-5 sm:p-6 border-b border-border-strong flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-primary mb-1">
                  {editingBlock ? "Edit Time Off Block" : "Block Unavailability / Time Off"}
                </h2>
                <p className="text-xs text-text-secondary">
                  Prevent public bookings for this professional during breaks, offline duties, or leave.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTimeOffModalOpen(false)}
                className="p-1.5 rounded-xl text-text-secondary hover:text-primary hover:bg-surface-muted transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleTimeOffSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                {timeOffModalError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{timeOffModalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Professional *
                  </label>
                  <select
                    required
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
                    Block Type *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["BREAK", "LEAVE", "OFFLINE_WORK", "OTHER"] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setTimeOffFormData({ ...timeOffFormData, type: t })}
                        className={`p-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                          timeOffFormData.type === t
                            ? `${getTypeBadgeColor(t)} ring-2 ring-accent`
                            : "bg-surface-muted border-border-strong text-text-secondary hover:text-primary"
                        }`}
                      >
                        {getTypeIcon(t)}
                        <span>{t.replace("_", " ")}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={timeOffFormData.startDate}
                      onChange={(e) =>
                        setTimeOffFormData({
                          ...timeOffFormData,
                          startDate: e.target.value,
                          endDate: e.target.value,
                        })
                      }
                      className="w-full p-2.5 rounded-xl border border-border-strong text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={timeOffFormData.endDate}
                      onChange={(e) =>
                        setTimeOffFormData({ ...timeOffFormData, endDate: e.target.value })
                      }
                      className="w-full p-2.5 rounded-xl border border-border-strong text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                      Start Time *
                    </label>
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
                      End Time *
                    </label>
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
                    onChange={(e: any) =>
                      setTimeOffFormData({ ...timeOffFormData, recurrence: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm bg-surface"
                  >
                    <option value="NONE">None (Single occurrence)</option>
                    <option value="DAILY">Daily (Repeats every day)</option>
                    <option value="WEEKLY">Weekly (Repeats same day every week)</option>
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
                        setTimeOffFormData({ ...timeOffFormData, recurrenceEnd: e.target.value })
                      }
                      className="w-full p-2.5 rounded-xl border border-border-strong text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Reason / Internal Note
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Doctor's appointment, inventory restock, team sync..."
                    value={timeOffFormData.reason}
                    onChange={(e) =>
                      setTimeOffFormData({ ...timeOffFormData, reason: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-border-strong text-sm"
                  />
                </div>
              </div>

              <div className="shrink-0 p-4 sm:p-6 border-t border-border-strong bg-surface flex items-center justify-end gap-3 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsTimeOffModalOpen(false)}
                  disabled={timeOffSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-border-strong text-text-secondary hover:text-primary hover:bg-surface-muted text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={timeOffSubmitting}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {timeOffSubmitting && <Loader2 size={16} className="animate-spin shrink-0" />}
                  <span>{timeOffSubmitting ? "Saving..." : editingBlock ? "Save Changes" : "Create Block"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD OFFLINE APPOINTMENT MODAL (Workflow B) */}
      {isOfflineModalOpen && (
        <div
          data-testid="record-offline-appointment-modal"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <div className="relative bg-surface rounded-3xl w-full max-w-xl shadow-2xl border border-border-strong flex flex-col max-h-[90vh] my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="shrink-0 p-5 sm:p-6 border-b border-border-strong flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-primary tracking-tight">
                  Record Offline Appointment
                </h2>
                <p className="text-xs text-text-secondary mt-1">
                  Enter walk-in, phone, or external bookings directly confirmed into the schedule.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOfflineModalOpen(false)}
                className="p-1.5 rounded-xl text-text-secondary hover:text-primary hover:bg-surface-muted transition-colors"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body & Form */}
            <form
              id="offline-appointment-form"
              onSubmit={handleOfflineSubmit}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                {offlineModalError && (
                  <div
                    data-testid="offline-modal-error"
                    className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2"
                  >
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{offlineModalError}</span>
                  </div>
                )}

                {/* Service Selection */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Service *
                  </label>
                  <select
                    id="offline-service-select"
                    data-testid="offline-service-select"
                    required
                    value={offlineFormData.serviceId}
                    onChange={(e) => {
                      const svcId = e.target.value;
                      const svc = services.find((s) => s.id === svcId);
                      let newEndTime = offlineFormData.endTime;
                      if (svc && offlineFormData.startTime) {
                        const [h, m] = offlineFormData.startTime.split(":").map(Number);
                        const totalMins = h * 60 + m + (svc.durationMins || 60);
                        const endH = String(Math.floor(totalMins / 60) % 24).padStart(2, "0");
                        const endM = String(totalMins % 60).padStart(2, "0");
                        newEndTime = `${endH}:${endM}`;
                      }
                      setOfflineFormData({
                        ...offlineFormData,
                        serviceId: svcId,
                        endTime: newEndTime,
                      });
                    }}
                    className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
                  >
                    {services.map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.name} ({svc.durationMins} mins, {formatAudPrice(svc.price)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assigned Professional */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Assigned Professional *
                  </label>
                  <select
                    id="offline-staff-select"
                    data-testid="offline-staff-select"
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

                {/* Date and Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                      Date *
                    </label>
                    <input
                      id="offline-date-input"
                      data-testid="offline-date-input"
                      type="date"
                      required
                      value={offlineFormData.date}
                      onChange={(e) =>
                        setOfflineFormData({ ...offlineFormData, date: e.target.value })
                      }
                      className="w-full p-2.5 rounded-xl border border-border-strong text-sm bg-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                      Start Time *
                    </label>
                    <input
                      id="offline-start-time-input"
                      data-testid="offline-start-time-input"
                      type="time"
                      required
                      value={offlineFormData.startTime}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const svc = services.find((s) => s.id === offlineFormData.serviceId);
                        let newEnd = offlineFormData.endTime;
                        if (svc && newStart) {
                          const [h, m] = newStart.split(":").map(Number);
                          const totalMins = h * 60 + m + (svc.durationMins || 60);
                          const endH = String(Math.floor(totalMins / 60) % 24).padStart(2, "0");
                          const endM = String(totalMins % 60).padStart(2, "0");
                          newEnd = `${endH}:${endM}`;
                        }
                        setOfflineFormData({
                          ...offlineFormData,
                          startTime: newStart,
                          endTime: newEnd,
                        });
                      }}
                      className="w-full p-2.5 rounded-xl border border-border-strong text-sm bg-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                      End Time *
                    </label>
                    <input
                      id="offline-end-time-input"
                      data-testid="offline-end-time-input"
                      type="time"
                      required
                      value={offlineFormData.endTime}
                      onChange={(e) =>
                        setOfflineFormData({ ...offlineFormData, endTime: e.target.value })
                      }
                      className="w-full p-2.5 rounded-xl border border-border-strong text-sm bg-surface"
                    />
                  </div>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                      Customer Name
                    </label>
                    <input
                      id="offline-customer-name"
                      data-testid="offline-customer-name"
                      type="text"
                      placeholder="Walk-in Customer"
                      value={offlineFormData.customerName}
                      onChange={(e) =>
                        setOfflineFormData({ ...offlineFormData, customerName: e.target.value })
                      }
                      className="w-full p-3 rounded-xl border border-border-strong text-sm bg-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                      Customer Phone
                    </label>
                    <input
                      id="offline-customer-phone"
                      data-testid="offline-customer-phone"
                      type="tel"
                      placeholder="e.g. 0412 345 678"
                      value={offlineFormData.customerPhone}
                      onChange={(e) =>
                        setOfflineFormData({ ...offlineFormData, customerPhone: e.target.value })
                      }
                      className="w-full p-3 rounded-xl border border-border-strong text-sm bg-surface"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Customer Email (Optional)
                  </label>
                  <input
                    id="offline-customer-email"
                    data-testid="offline-customer-email"
                    type="email"
                    placeholder="Optional customer email"
                    value={offlineFormData.customerEmail}
                    onChange={(e) =>
                      setOfflineFormData({ ...offlineFormData, customerEmail: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-border-strong text-sm bg-surface"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Job Notes / Instructions
                  </label>
                  <textarea
                    id="offline-notes"
                    data-testid="offline-notes"
                    rows={2}
                    placeholder="Offline booking notes or special job instructions..."
                    value={offlineFormData.notes}
                    onChange={(e) =>
                      setOfflineFormData({ ...offlineFormData, notes: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-border-strong text-sm bg-surface"
                  />
                </div>
              </div>

              {/* Modal Footer - Always visible & accessible across screen sizes */}
              <div className="shrink-0 p-4 sm:p-6 border-t border-border-strong bg-surface flex items-center justify-end gap-3 rounded-b-3xl">
                <button
                  type="button"
                  data-testid="cancel-offline-appointment-btn"
                  onClick={() => setIsOfflineModalOpen(false)}
                  disabled={offlineSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-border-strong text-text-secondary hover:text-primary hover:bg-surface-muted text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="save-offline-appointment-btn"
                  disabled={offlineSubmitting}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {offlineSubmitting && <Loader2 size={16} className="animate-spin shrink-0" />}
                  <span>{offlineSubmitting ? "Saving..." : "Save Appointment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPOINTMENT DETAILS MODAL */}
      {viewingAppointment && (
        <div
          data-testid="view-appointment-modal"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <div className="relative bg-surface rounded-3xl w-full max-w-lg shadow-2xl border border-border-strong flex flex-col max-h-[90vh] my-auto overflow-hidden">
            <div className="shrink-0 p-5 sm:p-6 border-b border-border-strong flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {viewingAppointment.customerNotes?.includes("[Offline Booking]")
                    ? "Offline Booking"
                    : "Appointment"}
                </span>
                <h2 className="text-xl font-bold text-primary mt-1">
                  {viewingAppointment.serviceName || viewingAppointment.service?.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingAppointment(null)}
                className="p-1.5 rounded-xl text-text-secondary hover:text-primary hover:bg-surface-muted transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-text-secondary font-bold uppercase text-[10px]">Date</span>
                  <p className="font-semibold text-primary text-sm mt-0.5">
                    {formatDisplayDate(viewingAppointment.startTime)}
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary font-bold uppercase text-[10px]">Time</span>
                  <p className="font-semibold text-primary text-sm mt-0.5 font-mono">
                    {getItemTimeString(viewingAppointment.startTime)} -{" "}
                    {getItemTimeString(viewingAppointment.endTime)}
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary font-bold uppercase text-[10px]">Professional</span>
                  <p className="font-semibold text-primary text-sm mt-0.5">
                    {viewingAppointment.staff?.user
                      ? `${viewingAppointment.staff.user.firstName} ${viewingAppointment.staff.user.lastName}`
                      : "Unassigned"}
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary font-bold uppercase text-[10px]">Price</span>
                  <p className="font-bold text-accent text-sm mt-0.5">
                    {formatAudPrice(viewingAppointment.price)}
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary font-bold uppercase text-[10px]">Status</span>
                  <p className="font-semibold text-primary mt-0.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      {viewingAppointment.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary font-bold uppercase text-[10px]">Duration</span>
                  <p className="font-semibold text-primary text-sm mt-0.5">
                    {viewingAppointment.durationMins} mins
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-border-strong text-xs space-y-2">
                <span className="text-text-secondary font-bold uppercase text-[10px]">Customer Details</span>
                <p className="font-semibold text-primary">
                  {viewingAppointment.customer
                    ? `${viewingAppointment.customer.firstName} ${viewingAppointment.customer.lastName}`
                    : viewingAppointment.customerNotes?.replace("[Offline Booking]", "").trim() || "Walk-in"}
                </p>
                {viewingAppointment.customer?.phone && (
                  <p className="text-text-secondary">Phone: {viewingAppointment.customer.phone}</p>
                )}
                {viewingAppointment.customer?.email && (
                  <p className="text-text-secondary">Email: {viewingAppointment.customer.email}</p>
                )}
              </div>

              {viewingAppointment.customerNotes && (
                <div className="pt-3 border-t border-border-strong text-xs">
                  <span className="text-text-secondary font-bold uppercase text-[10px]">Job Notes</span>
                  <p className="text-text-secondary mt-1 bg-surface-muted p-3 rounded-xl border border-border-strong italic">
                    "{viewingAppointment.customerNotes}"
                  </p>
                </div>
              )}
            </div>

            <div className="shrink-0 p-4 sm:p-6 border-t border-border-strong bg-surface flex items-center justify-between rounded-b-3xl">
              <Link
                href={`/portal/business/appointments?id=${viewingAppointment.id}`}
                className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
              >
                <ExternalLink size={14} /> Open in Appointments Manager
              </Link>
              <button
                type="button"
                data-testid="close-appointment-details-btn"
                onClick={() => setViewingAppointment(null)}
                className="px-4 py-2 rounded-xl bg-surface border border-border-strong text-text-primary text-xs font-semibold hover:bg-surface-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}