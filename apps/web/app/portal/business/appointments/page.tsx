"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/utils/api";
import { getAccessToken, getCurrentUser } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import {
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Eye,
  UserCheck,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { canUseBusinessCapability } from "@/utils/capabilities";
import { useRouter, useSearchParams } from "next/navigation";

export default function BusinessAppointmentsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "list" ? "LIST" : "OVERVIEW";

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "LIST" | "PENDING" | "CALENDAR"
  >(initialTab as any);

  // Filters for LIST tab
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>(""); // YYYY-MM-DD

  // Calendar view mode: 'DAY' or 'WEEK'
  const [calendarMode, setCalendarMode] = useState<"DAY" | "WEEK">("WEEK");

  // Review & Assignment Modal state
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(
    null,
  );
  const [eligibleStaff, setEligibleStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Detail View Modal state
  const [viewingAppointment, setViewingAppointment] = useState<any | null>(
    null,
  );

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/api/v1/business-appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch appointments");
      const data = await res.json();
      setAppointments(data);
    } catch (err: any) {
      setError(err.message || "An error occurred fetching appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (
      !user ||
      !canUseBusinessCapability(user.businessCategory as any, "APPOINTMENTS")
    ) {
      router.replace("/portal");
      return;
    }
    fetchAppointments();
  }, [router]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "list") {
      setActiveTab("LIST");
    }
  }, [searchParams]);

  const loadEligibleStaff = async (appointmentId: string) => {
    try {
      setLoadingStaff(true);
      setSelectedStaffId("");
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/${appointmentId}/eligible-staff`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to load eligible staff");
      const data = await res.json();
      setEligibleStaff(data);
      // Auto-select first available staff if any
      const firstAvailable = data.find((s: any) => s.isAvailable);
      if (firstAvailable) {
        setSelectedStaffId(firstAvailable.staffId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedStaffId || !selectedAppointment) return;
    try {
      setActionLoading(true);
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/${selectedAppointment.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ staffId: selectedStaffId }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to approve");
      }
      setSelectedAppointment(null);
      await fetchAppointments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAppointment) return;
    try {
      setActionLoading(true);
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/${selectedAppointment.id}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: rejectReason }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to reject");
      }
      setSelectedAppointment(null);
      setRejectReason("");
      await fetchAppointments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      setActionLoading(true);
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/${id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update status");
      }
      if (viewingAppointment?.id === id) {
        setViewingAppointment((prev: any) => ({ ...prev, status }));
      }
      await fetchAppointments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && appointments.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  // Summary counts
  const pendingRequests = appointments.filter(
    (a) => a.status === "PENDING_APPROVAL",
  );
  const confirmed = appointments.filter((a) => a.status === "CONFIRMED");
  const inProgress = appointments.filter((a) => a.status === "IN_PROGRESS");
  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const cancelled = appointments.filter(
    (a) => a.status === "CANCELLED" || a.status === "REJECTED",
  );

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const todayAppointments = appointments.filter((a) => {
    const d = new Date(a.startTime);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  });

  // Filtered appointments for List view
  const filteredAppointments = appointments.filter((a) => {
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    if (dateFilter) {
      const aDate = new Date(a.startTime).toISOString().split("T")[0];
      if (aDate !== dateFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const customerName =
        `${a.customer?.firstName || ""} ${a.customer?.lastName || ""}`.toLowerCase();
      const serviceName = (a.service?.name || "").toLowerCase();
      const staffName =
        `${a.staff?.user?.firstName || ""} ${a.staff?.user?.lastName || ""}`.toLowerCase();
      if (
        !customerName.includes(q) &&
        !serviceName.includes(q) &&
        !staffName.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Appointments Management"
          description="Review requests, assign qualified professionals, and oversee business scheduling."
        />
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push("/portal/business/availability")}
            className="flex items-center gap-2 px-3.5 py-2 bg-surface border border-border-strong rounded-xl text-sm font-semibold hover:bg-surface-muted transition-colors shadow-xs"
          >
            <CalendarIcon size={16} className="text-accent" />
            Manage Availability
          </button>
          <button
            onClick={fetchAppointments}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 border border-border-strong rounded-xl text-sm font-semibold hover:bg-surface-muted transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border-strong overflow-x-auto">
        {[
          { id: "OVERVIEW", label: "Overview" },
          { id: "LIST", label: `All Appointments (${appointments.length})` },
          {
            id: "PENDING",
            label: `Pending Requests (${pendingRequests.length})`,
          },
          { id: "CALENDAR", label: "Calendar View" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-3 font-semibold text-sm whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label="Pending Requests"
              value={pendingRequests.length.toString()}
              icon={<AlertCircle size={20} className="text-amber-500" />}
            />
            <StatCard
              label="Confirmed"
              value={confirmed.length.toString()}
              icon={<CheckCircle size={20} className="text-emerald-500" />}
            />
            <StatCard
              label="Today's Bookings"
              value={todayAppointments.length.toString()}
              icon={<CalendarIcon size={20} className="text-blue-500" />}
            />
            <StatCard
              label="Completed"
              value={completed.length.toString()}
              icon={<CheckCircle size={20} className="text-teal-600" />}
            />
            <StatCard
              label="Cancelled / Rejected"
              value={cancelled.length.toString()}
              icon={<XCircle size={20} className="text-rose-500" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Schedule Card */}
            <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-border-strong bg-surface-muted/50 flex items-center justify-between">
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <CalendarIcon size={18} className="text-accent" />
                  Today's Schedule ({todayAppointments.length})
                </h3>
                <span className="text-xs font-semibold text-text-secondary">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="divide-y divide-border-strong flex-1 overflow-y-auto max-h-96">
                {todayAppointments.length === 0 ? (
                  <div className="p-8 text-center text-text-secondary text-sm">
                    No appointments scheduled for today.
                  </div>
                ) : (
                  todayAppointments
                    .sort(
                      (a, b) =>
                        new Date(a.startTime).getTime() -
                        new Date(b.startTime).getTime(),
                    )
                    .map((appt) => (
                      <div
                        key={appt.id}
                        className="p-4 flex items-center justify-between gap-4 hover:bg-surface-muted/40 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-primary text-sm">
                              {new Date(appt.startTime).toLocaleTimeString(
                                undefined,
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                                appt.status === "CONFIRMED"
                                  ? "bg-green-100 text-green-700"
                                  : appt.status === "IN_PROGRESS"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {appt.status.replace("_", " ")}
                            </span>
                          </div>
                          <div className="font-semibold text-primary text-sm">
                            {appt.service?.name}
                          </div>
                          <div className="text-xs text-text-secondary">
                            Customer: {appt.customer?.firstName}{" "}
                            {appt.customer?.lastName}
                          </div>
                          {appt.staff && (
                            <div className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                              <MapPin size={12} /> Pro:{" "}
                              {appt.staff.user?.firstName}{" "}
                              {appt.staff.user?.lastName}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewingAppointment(appt)}
                            className="p-2 text-text-secondary hover:text-primary rounded-lg hover:bg-surface-muted"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          {appt.status === "CONFIRMED" && (
                            <button
                              onClick={() =>
                                handleStatusUpdate(appt.id, "IN_PROGRESS")
                              }
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100"
                            >
                              Start
                            </button>
                          )}
                          {appt.status === "IN_PROGRESS" && (
                            <button
                              onClick={() =>
                                handleStatusUpdate(appt.id, "COMPLETED")
                              }
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Pending Requests Spotlight Card */}
            <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-border-strong bg-surface-muted/50 flex items-center justify-between">
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" />
                  Pending Review ({pendingRequests.length})
                </h3>
                {pendingRequests.length > 0 && (
                  <button
                    onClick={() => setActiveTab("PENDING")}
                    className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                  >
                    View All <ChevronRight size={14} />
                  </button>
                )}
              </div>
              <div className="divide-y divide-border-strong flex-1 overflow-y-auto max-h-96">
                {pendingRequests.length === 0 ? (
                  <div className="p-8 text-center text-text-secondary text-sm">
                    <CheckCircle
                      size={32}
                      className="mx-auto mb-2 text-green-500 opacity-70"
                    />
                    No pending appointment requests. All caught up!
                  </div>
                ) : (
                  pendingRequests.slice(0, 5).map((req) => (
                    <div
                      key={req.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-surface-muted/40 transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-primary text-sm">
                          {req.service?.name}
                        </div>
                        <div className="text-xs text-text-secondary mt-0.5">
                          {new Date(req.startTime).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="text-xs text-text-secondary mt-0.5">
                          Customer: {req.customer?.firstName}{" "}
                          {req.customer?.lastName}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedAppointment(req);
                          loadEligibleStaff(req.id);
                        }}
                        className="px-3 py-1.5 bg-brand-navy text-white text-xs font-bold rounded-lg hover:bg-brand-navy/90 shrink-0"
                      >
                        Assign Pro
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALL APPOINTMENTS LIST TAB */}
      {activeTab === "LIST" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-surface p-4 rounded-2xl border border-border-strong flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex-1 relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                type="text"
                placeholder="Search by customer, service or pro..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {(statusFilter !== "ALL" || dateFilter || searchQuery) && (
                <button
                  onClick={() => {
                    setStatusFilter("ALL");
                    setDateFilter("");
                    setSearchQuery("");
                  }}
                  className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Appointments Table */}
          <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-muted/60 text-text-secondary font-semibold border-b border-border-strong text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Service</th>
                    <th className="px-6 py-3">Date & Time</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3">Branch</th>
                    <th className="px-6 py-3">Assigned Pro</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-strong">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-text-secondary"
                      >
                        No appointments match your selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((appt) => (
                      <tr
                        key={appt.id}
                        className="hover:bg-surface-muted/30 transition-colors"
                      >
                        <td className="px-6 py-4 font-semibold text-primary">
                          {appt.customer?.firstName} {appt.customer?.lastName}
                          {appt.customer?.phone && (
                            <div className="text-xs text-text-secondary font-normal">
                              {appt.customer.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-primary">
                            {appt.service?.name}
                          </span>
                          {appt.service?.price && (
                            <div className="text-xs text-text-secondary font-normal">
                              AUD ${Number(appt.service.price).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-primary">
                            {new Date(appt.startTime).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </div>
                          <div className="text-xs text-text-secondary">
                            {new Date(appt.startTime).toLocaleTimeString(
                              undefined,
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-text-secondary">
                          {appt.service?.durationMinutes
                            ? `${appt.service.durationMinutes} min`
                            : "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-text-secondary">
                          {appt.branch?.name || "Main Branch"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {appt.staff ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                              <UserCheck size={12} />
                              {appt.staff.user?.firstName}{" "}
                              {appt.staff.user?.lastName}
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted italic">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              appt.status === "CONFIRMED"
                                ? "bg-green-100 text-green-800"
                                : appt.status === "PENDING_APPROVAL"
                                  ? "bg-amber-100 text-amber-800"
                                  : appt.status === "IN_PROGRESS"
                                    ? "bg-blue-100 text-blue-800"
                                    : appt.status === "COMPLETED"
                                      ? "bg-teal-100 text-teal-800"
                                      : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {appt.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewingAppointment(appt)}
                              className="p-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-surface-muted"
                              title="View details"
                            >
                              <Eye size={16} />
                            </button>
                            {appt.status === "PENDING_APPROVAL" && (
                              <button
                                onClick={() => {
                                  setSelectedAppointment(appt);
                                  loadEligibleStaff(appt.id);
                                }}
                                className="px-2.5 py-1 bg-brand-navy text-white text-xs font-bold rounded-lg hover:bg-brand-navy/90"
                              >
                                Review
                              </button>
                            )}
                            {appt.status === "CONFIRMED" && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(appt.id, "IN_PROGRESS")
                                }
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100"
                              >
                                Start
                              </button>
                            )}
                            {appt.status === "IN_PROGRESS" && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(appt.id, "COMPLETED")
                                }
                                className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100"
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PENDING APPROVALS TAB */}
      {activeTab === "PENDING" && (
        <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden">
          <div className="px-6 py-4 border-b border-border-strong bg-surface-muted/50 flex items-center justify-between">
            <h3 className="font-bold text-primary">
              Pending Appointment Requests
            </h3>
            <span className="text-xs font-semibold text-text-secondary">
              Customer bookings awaiting professional assignment
            </span>
          </div>
          {pendingRequests.length === 0 ? (
            <div className="p-12 text-center text-text-secondary">
              <CheckCircle
                size={44}
                className="mx-auto mb-3 text-green-500 opacity-80"
              />
              <p className="font-semibold text-primary">All caught up!</p>
              <p className="text-sm text-text-muted mt-1">
                There are no pending requests requiring approval.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-strong">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-6 flex flex-col md:flex-row gap-6"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-lg text-primary">
                        {req.service?.name}
                      </h4>
                      <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-800">
                        PENDING APPROVAL
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-text-secondary font-medium">
                      <span className="flex items-center gap-1.5 text-primary font-semibold">
                        <CalendarIcon size={14} className="text-accent" />
                        {new Date(req.startTime).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} />
                        {req.service?.durationMinutes} min
                      </span>
                      {req.service?.price && (
                        <span>AUD ${Number(req.service.price).toFixed(2)}</span>
                      )}
                    </div>
                    <div className="mt-3 bg-surface-muted p-3.5 rounded-xl border border-border-strong/50 text-sm">
                      <div className="font-semibold text-primary">
                        Customer: {req.customer?.firstName}{" "}
                        {req.customer?.lastName}
                        {req.customer?.email && (
                          <span className="font-normal text-text-secondary ml-2">
                            ({req.customer.email})
                          </span>
                        )}
                      </div>
                      {req.customerNotes && (
                        <div className="mt-1.5 text-text-secondary italic text-xs">
                          Customer notes: "{req.customerNotes}"
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-full md:w-56 shrink-0 flex flex-col gap-2 justify-center">
                    <button
                      onClick={() => {
                        setSelectedAppointment(req);
                        loadEligibleStaff(req.id);
                      }}
                      className="w-full py-2.5 bg-brand-navy text-white rounded-xl font-bold hover:bg-brand-navy/90 text-sm shadow-sm"
                    >
                      Review & Assign
                    </button>
                    <button
                      onClick={() => setViewingAppointment(req)}
                      className="w-full py-2 bg-surface border border-border-strong text-text-secondary rounded-xl font-semibold hover:text-primary text-xs"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CALENDAR VIEW TAB */}
      {activeTab === "CALENDAR" && (
        <div className="bg-surface rounded-2xl border border-border-strong p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg text-primary">
                Schedule Calendar
              </h3>
              <p className="text-xs text-text-secondary">
                View confirmed and upcoming appointments across your business.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalendarMode("DAY")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  calendarMode === "DAY"
                    ? "bg-accent text-white"
                    : "bg-surface-muted text-text-secondary hover:text-primary"
                }`}
              >
                Today ({todayAppointments.length})
              </button>
              <button
                onClick={() => setCalendarMode("WEEK")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  calendarMode === "WEEK"
                    ? "bg-accent text-white"
                    : "bg-surface-muted text-text-secondary hover:text-primary"
                }`}
              >
                Upcoming Schedule
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {(calendarMode === "DAY"
              ? todayAppointments
              : appointments.filter(
                  (a) => !["CANCELLED", "REJECTED"].includes(a.status),
                )
            )
              .sort(
                (a, b) =>
                  new Date(a.startTime).getTime() -
                  new Date(b.startTime).getTime(),
              )
              .map((appt) => {
                const d = new Date(appt.startTime);
                return (
                  <div
                    key={appt.id}
                    className="p-4 border border-border-strong rounded-xl flex items-center justify-between gap-4 hover:bg-surface-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-surface-muted p-3 rounded-lg text-center min-w-[64px]">
                        <div className="text-xs font-bold text-text-secondary uppercase">
                          {d.toLocaleString(undefined, { month: "short" })}
                        </div>
                        <div className="text-xl font-extrabold text-primary">
                          {d.getDate()}
                        </div>
                        <div className="text-[10px] text-text-muted">
                          {d.toLocaleString(undefined, { weekday: "short" })}
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-primary">
                          {appt.service?.name}
                        </div>
                        <div className="text-xs text-text-secondary flex items-center gap-2 mt-1">
                          <Clock size={12} />{" "}
                          {d.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          <span className="font-medium text-text-muted">
                            ({appt.service?.durationMinutes || 30} min)
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                              appt.status === "CONFIRMED"
                                ? "bg-green-100 text-green-700"
                                : appt.status === "PENDING_APPROVAL"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {appt.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary mt-1">
                          Customer: {appt.customer?.firstName}{" "}
                          {appt.customer?.lastName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {appt.staff ? (
                        <div className="hidden sm:block text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">
                          Assigned: {appt.staff.user?.firstName}{" "}
                          {appt.staff.user?.lastName}
                        </div>
                      ) : (
                        <span className="hidden sm:block text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium">
                          Unassigned
                        </span>
                      )}
                      <button
                        onClick={() => setViewingAppointment(appt)}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-surface-muted"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            {appointments.length === 0 && (
              <div className="p-12 text-center text-text-secondary">
                No appointments recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review & Assignment Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold text-primary mb-2">
              Review Appointment Request
            </h2>
            <p className="text-xs text-text-secondary mb-4">
              The customer requested this appointment. Select an eligible
              qualified professional to approve and confirm the booking.
            </p>

            <div className="bg-surface-muted p-4 rounded-xl border border-border-strong mb-6 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-primary">
                    {selectedAppointment.service?.name}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {selectedAppointment.service?.durationMinutes} mins
                    {selectedAppointment.service?.price &&
                      ` • AUD $${Number(selectedAppointment.service.price).toFixed(2)}`}
                  </div>
                </div>
                <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-800">
                  PENDING
                </span>
              </div>
              <div className="text-sm font-medium text-primary">
                Time:{" "}
                {new Date(selectedAppointment.startTime).toLocaleString(
                  undefined,
                  {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </div>
              <div className="text-sm text-text-secondary">
                Customer: {selectedAppointment.customer?.firstName}{" "}
                {selectedAppointment.customer?.lastName}
                {selectedAppointment.customer?.phone &&
                  ` (${selectedAppointment.customer.phone})`}
              </div>
              {selectedAppointment.customerNotes && (
                <div className="text-xs mt-1 italic text-text-secondary bg-surface p-2 rounded-lg border border-border-strong/50">
                  "{selectedAppointment.customerNotes}"
                </div>
              )}
            </div>

            <div className="mb-6">
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Assign Eligible Professional</span>
                <span className="text-[11px] font-normal text-text-secondary lowercase">
                  (qualified & available)
                </span>
              </h3>
              {loadingStaff ? (
                <div className="flex items-center gap-2 text-sm text-text-secondary p-4 bg-surface-muted rounded-xl">
                  <Loader2 size={16} className="animate-spin" /> Verifying
                  qualifications & schedule conflicts...
                </div>
              ) : eligibleStaff.length === 0 ? (
                <div className="text-red-600 text-sm p-4 bg-red-50 border border-red-200 rounded-xl">
                  No professionals are currently assigned to this service or
                  available at this time.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                  {eligibleStaff.map((staff) => (
                    <label
                      key={staff.staffId}
                      className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                        !staff.isAvailable
                          ? "opacity-50 bg-gray-50 border-gray-200 cursor-not-allowed"
                          : selectedStaffId === staff.staffId
                            ? "border-accent bg-accent/5"
                            : "border-border-strong hover:border-accent"
                      }`}
                    >
                      <input
                        type="radio"
                        name="staff"
                        value={staff.staffId}
                        disabled={!staff.isAvailable}
                        checked={selectedStaffId === staff.staffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-primary text-sm">
                          {staff.user?.firstName} {staff.user?.lastName}
                        </div>
                        <div className="text-xs text-text-secondary">
                          {staff.isAvailable ? (
                            <span className="text-green-600 font-bold">
                              ✓ Available for assignment
                            </span>
                          ) : (
                            <span className="text-red-500 font-medium">
                              {staff.reason}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                disabled={!selectedStaffId || actionLoading}
                onClick={handleApprove}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm text-sm"
              >
                {actionLoading && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Approve & Assign Professional
              </button>

              <div className="border-t border-border-strong my-1"></div>

              <input
                type="text"
                placeholder="Reason for rejection (optional)"
                className="w-full p-2.5 rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <button
                disabled={actionLoading}
                onClick={handleReject}
                className="w-full py-2.5 bg-white text-red-600 border border-red-200 font-bold rounded-xl hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {actionLoading && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Reject Request
              </button>

              <button
                onClick={() => {
                  setSelectedAppointment(null);
                  setSelectedStaffId("");
                  setRejectReason("");
                }}
                className="w-full py-2 bg-transparent text-text-secondary font-semibold hover:text-primary transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Detail Modal */}
      {viewingAppointment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded ${
                    viewingAppointment.status === "CONFIRMED"
                      ? "bg-green-100 text-green-800"
                      : viewingAppointment.status === "PENDING_APPROVAL"
                        ? "bg-amber-100 text-amber-800"
                        : viewingAppointment.status === "IN_PROGRESS"
                          ? "bg-blue-100 text-blue-800"
                          : viewingAppointment.status === "COMPLETED"
                            ? "bg-teal-100 text-teal-800"
                            : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {viewingAppointment.status.replace("_", " ")}
                </span>
                <h2 className="text-xl font-bold text-primary mt-2">
                  {viewingAppointment.service?.name}
                </h2>
              </div>
              <button
                onClick={() => setViewingAppointment(null)}
                className="text-text-secondary hover:text-primary p-1 rounded-lg"
              >
                <XCircle size={22} />
              </button>
            </div>

            <div className="space-y-4 text-sm divide-y divide-border-strong">
              <div className="pt-2 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-text-secondary font-medium">
                    Date & Time
                  </div>
                  <div className="font-semibold text-primary mt-0.5">
                    {new Date(viewingAppointment.startTime).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary font-medium">
                    Duration
                  </div>
                  <div className="font-semibold text-primary mt-0.5">
                    {viewingAppointment.service?.durationMinutes} minutes
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <div className="text-xs text-text-secondary font-medium">
                  Customer Information
                </div>
                <div className="font-semibold text-primary mt-1">
                  {viewingAppointment.customer?.firstName}{" "}
                  {viewingAppointment.customer?.lastName}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  Email: {viewingAppointment.customer?.email || "N/A"}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  Phone: {viewingAppointment.customer?.phone || "N/A"}
                </div>
                {viewingAppointment.customerNotes && (
                  <div className="mt-2 p-2 bg-surface-muted rounded-lg text-xs italic">
                    "{viewingAppointment.customerNotes}"
                  </div>
                )}
              </div>

              <div className="pt-3">
                <div className="text-xs text-text-secondary font-medium">
                  Assigned Professional
                </div>
                {viewingAppointment.staff ? (
                  <div className="font-semibold text-primary mt-1 flex items-center gap-2">
                    <UserCheck size={16} className="text-blue-600" />
                    {viewingAppointment.staff.user?.firstName}{" "}
                    {viewingAppointment.staff.user?.lastName} (
                    {viewingAppointment.staff.user?.email})
                  </div>
                ) : (
                  <div className="text-xs text-amber-600 font-semibold mt-1">
                    No professional assigned yet
                  </div>
                )}
              </div>

              {viewingAppointment.rejectionReason && (
                <div className="pt-3">
                  <div className="text-xs text-red-600 font-medium">
                    Rejection Reason
                  </div>
                  <div className="text-xs text-red-700 mt-1">
                    "{viewingAppointment.rejectionReason}"
                  </div>
                </div>
              )}
            </div>

            {/* Quick status actions */}
            <div className="mt-6 pt-4 border-t border-border-strong flex flex-wrap gap-2 justify-end">
              {viewingAppointment.status === "PENDING_APPROVAL" && (
                <button
                  onClick={() => {
                    const appt = viewingAppointment;
                    setViewingAppointment(null);
                    setSelectedAppointment(appt);
                    loadEligibleStaff(appt.id);
                  }}
                  className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl hover:bg-brand-navy/90"
                >
                  Review & Assign
                </button>
              )}
              {viewingAppointment.status === "CONFIRMED" && (
                <button
                  onClick={() =>
                    handleStatusUpdate(viewingAppointment.id, "IN_PROGRESS")
                  }
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
                >
                  Start Appointment
                </button>
              )}
              {viewingAppointment.status === "IN_PROGRESS" && (
                <button
                  onClick={() =>
                    handleStatusUpdate(viewingAppointment.id, "COMPLETED")
                  }
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700"
                >
                  Mark Completed
                </button>
              )}
              <button
                onClick={() => setViewingAppointment(null)}
                className="px-4 py-2 border border-border-strong text-text-secondary text-xs font-semibold rounded-xl hover:bg-surface-muted"
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
