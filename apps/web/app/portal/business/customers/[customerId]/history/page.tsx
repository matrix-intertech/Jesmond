"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getApiUrl } from "@/utils/api";
import { getAccessToken, getCurrentUser, getDashboardRouteForUser, buildAuthHeaders } from "@/utils/auth";
import { canUseBusinessCapability } from "@/utils/capabilities";
import { formatAudPrice } from "@/utils/pricing";
import { getItemDateString, getItemTimeString, formatDisplayDate } from "@/utils/datetime";
import PageHeader from "@/components/ui/PageHeader";
import {
  Loader2,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  Search,
  CheckCircle2,
  CalendarCheck2,
  XCircle,
  AlertCircle,
  FileText,
  Briefcase,
  Layers,
  ChevronDown,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface CustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  createdAt: string;
}

interface AppointmentSummary {
  total: number;
  completed: number;
  upcoming: number;
  cancelled: number;
}

interface StaffMember {
  id: string;
  role?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ServiceInfo {
  id: string;
  name: string;
  description?: string | null;
  durationMins: number;
  price: number;
  currency?: string;
}

interface BusinessAppointment {
  id: string;
  organizationId: string;
  branchId: string;
  customerId: string;
  serviceId: string;
  serviceName: string;
  durationMins: number;
  price: number;
  currency: string;
  status: "PENDING_APPROVAL" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED" | "CANCELLED" | "NO_SHOW";
  startTime: string;
  endTime: string;
  timezone: string;
  customerNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  service?: ServiceInfo | null;
  staff?: StaffMember | null;
  branch?: {
    id: string;
    name: string;
  } | null;
}

export default function CustomerAppointmentHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params?.customerId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [appointments, setAppointments] = useState<BusinessAppointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<BusinessAppointment | null>(null);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Fetch Customer History Data
  const fetchCustomerHistory = async () => {
    if (!customerId) return;
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/customers/${customerId}/history`,
        {
          headers: buildAuthHeaders(),
        },
      );

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Customer not found or does not belong to this business.");
        }
        if (res.status === 403) {
          throw new Error("Access denied. Customer does not belong to your organization.");
        }
        throw new Error("Failed to load customer appointment history.");
      }

      const data = await res.json();
      setCustomer(data.customer);
      setAppointments(data.appointments || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (
      user &&
      !canUseBusinessCapability(
        user.businessCategory as any,
        "APPOINTMENT_CUSTOMERS",
      )
    ) {
      router.replace(getDashboardRouteForUser(user));
      return;
    }
    fetchCustomerHistory();
  }, [customerId, router]);

  // Derived Summary Counts from Actual Appointment Records
  const summaryMetrics: AppointmentSummary = useMemo(() => {
    const now = new Date();
    return {
      total: appointments.length,
      completed: appointments.filter((a) => a.status === "COMPLETED").length,
      upcoming: appointments.filter(
        (a) =>
          ["CONFIRMED", "PENDING_APPROVAL", "IN_PROGRESS"].includes(a.status) &&
          new Date(a.startTime) >= now,
      ).length,
      cancelled: appointments.filter((a) =>
        ["CANCELLED", "REJECTED", "NO_SHOW"].includes(a.status),
      ).length,
    };
  }, [appointments]);

  // Filtered & Sorted Appointments
  const filteredAppointments = useMemo(() => {
    let result = [...appointments];

    // Search query filter (service name, appointment ID, staff name)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.serviceName.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          (a.staff?.user &&
            `${a.staff.user.firstName} ${a.staff.user.lastName}`
              .toLowerCase()
              .includes(q)),
      );
    }

    // Status filter
    if (statusFilter !== "ALL") {
      result = result.filter((a) => a.status === statusFilter);
    }

    // Start date filter
    if (startDateFilter) {
      const start = new Date(startDateFilter);
      result = result.filter((a) => new Date(a.startTime) >= start);
    }

    // End date filter
    if (endDateFilter) {
      const end = new Date(endDateFilter);
      end.setHours(23, 59, 59, 999);
      result = result.filter((a) => new Date(a.startTime) <= end);
    }

    // Sort order
    result.sort((a, b) => {
      const dateA = new Date(a.startTime).getTime();
      const dateB = new Date(b.startTime).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [appointments, searchQuery, statusFilter, startDateFilter, endDateFilter, sortOrder]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "ALL" ||
    startDateFilter !== "" ||
    endDateFilter !== "" ||
    sortOrder !== "newest";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setStartDateFilter("");
    setEndDateFilter("");
    setSortOrder("newest");
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
            <CheckCircle2 size={12} />
            Completed
          </span>
        );
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <CalendarCheck2 size={12} />
            Confirmed
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock size={12} />
            Pending Approval
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Layers size={12} />
            In Progress
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle size={12} />
            Cancelled
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <XCircle size={12} />
            Rejected
          </span>
        );
      case "NO_SHOW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-300">
            <AlertCircle size={12} />
            No Show
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-surface-muted text-text-secondary border border-border-strong">
            {status}
          </span>
        );
    }
  };

  // Booking Type Helper
  const isOfflineBooking = (customerNotes?: string | null) => {
    return !!customerNotes && customerNotes.includes("[Offline Booking]");
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-12">
      {/* Back Navigation & Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Link
          href="/portal/business/customers"
          data-testid="back-to-customers-btn"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-surface-muted border border-transparent hover:border-border-strong"
        >
          <ArrowLeft size={14} />
          Back to Customers
        </Link>
        <span className="text-text-muted">/</span>
        <span className="text-xs text-text-muted">Customer History</span>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div data-testid="history-loading" className="flex flex-col items-center justify-center h-80 bg-surface rounded-3xl border border-border-strong">
          <Loader2 className="animate-spin text-primary mb-3" size={36} />
          <p className="text-sm font-semibold text-text-secondary">
            Loading customer appointment history...
          </p>
        </div>
      )}

      {/* Error / Customer Not Found State */}
      {!loading && error && (
        <div
          data-testid="customer-not-found-state"
          className="p-8 bg-surface rounded-3xl border border-rose-200 text-center max-w-xl mx-auto my-12 shadow-sm"
        >
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <AlertCircle size={28} />
          </div>
          <h3 className="text-lg font-bold text-primary mb-2">Unable to Load Customer</h3>
          <p className="text-sm text-text-secondary mb-6">{error}</p>
          <Link
            href="/portal/business/customers"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm"
          >
            <ArrowLeft size={14} />
            Return to Customers
          </Link>
        </div>
      )}

      {/* Main Content When Customer Loaded */}
      {!loading && !error && customer && (
        <>
          {/* Customer Profile Header */}
          <div
            data-testid="customer-profile-header"
            className="bg-surface rounded-3xl p-6 sm:p-8 border border-border-strong shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <User size={30} />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
                    {customer.firstName} {customer.lastName}
                  </h1>
                  <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-full">
                    {appointments.length} {appointments.length === 1 ? "Booking" : "Bookings"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-text-secondary mt-2">
                  <div className="flex items-center gap-1.5">
                    <Mail size={14} className="text-text-muted" />
                    <span>{customer.email}</span>
                  </div>
                  {customer.phone ? (
                    <div className="flex items-center gap-1.5">
                      <Phone size={14} className="text-text-muted" />
                      <span>{customer.phone}</span>
                    </div>
                  ) : (
                    <span className="text-text-muted italic flex items-center gap-1">
                      <Phone size={14} /> No phone provided
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <Calendar size={14} />
                    <span>Customer since {new Date(customer.createdAt).getFullYear()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/portal/business/customers"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface-muted hover:bg-border-strong text-primary border border-border-strong transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={13} />
                All Customers
              </Link>
            </div>
          </div>

          {/* Appointment Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div
              data-testid="card-total-appointments"
              className="bg-surface p-5 sm:p-6 rounded-3xl border border-border-strong shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-text-secondary mb-3">
                <span className="text-xs font-bold uppercase tracking-wider">Total Bookings</span>
                <div className="p-2 bg-surface-muted rounded-xl text-primary">
                  <Calendar size={18} />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-primary">{summaryMetrics.total}</div>
                <p className="text-xs text-text-muted mt-1">All recorded bookings</p>
              </div>
            </div>

            <div
              data-testid="card-completed-appointments"
              className="bg-surface p-5 sm:p-6 rounded-3xl border border-border-strong shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-teal-700 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
                <div className="p-2 bg-teal-50 rounded-xl text-teal-600 border border-teal-100">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-teal-700">{summaryMetrics.completed}</div>
                <p className="text-xs text-text-muted mt-1">Successfully fulfilled</p>
              </div>
            </div>

            <div
              data-testid="card-upcoming-appointments"
              className="bg-surface p-5 sm:p-6 rounded-3xl border border-border-strong shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-blue-700 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider">Upcoming</span>
                <div className="p-2 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
                  <CalendarCheck2 size={18} />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-blue-700">{summaryMetrics.upcoming}</div>
                <p className="text-xs text-text-muted mt-1">Active / future schedule</p>
              </div>
            </div>

            <div
              data-testid="card-cancelled-appointments"
              className="bg-surface p-5 sm:p-6 rounded-3xl border border-border-strong shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-rose-700 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider">Cancelled / Rejected</span>
                <div className="p-2 bg-rose-50 rounded-xl text-rose-600 border border-rose-100">
                  <XCircle size={18} />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-rose-700">{summaryMetrics.cancelled}</div>
                <p className="text-xs text-text-muted mt-1">Cancelled or declined</p>
              </div>
            </div>
          </div>

          {/* Search, Filter & Controls Toolbar */}
          <div className="bg-surface p-5 rounded-3xl border border-border-strong shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
                />
                <input
                  type="text"
                  data-testid="search-appointments-input"
                  placeholder="Search by service or appointment ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-border-strong bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Status Filter */}
              <select
                data-testid="filter-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-border-strong bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REJECTED">Rejected</option>
                <option value="NO_SHOW">No Show</option>
              </select>

              {/* Date Range Filters */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  data-testid="filter-start-date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  title="Start Date"
                  className="py-2 px-2.5 text-xs rounded-xl border border-border-strong bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-text-muted text-xs">to</span>
                <input
                  type="date"
                  data-testid="filter-end-date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  title="End Date"
                  className="py-2 px-2.5 text-xs rounded-xl border border-border-strong bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Sort Order */}
              <select
                data-testid="sort-appointments-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-border-strong bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            {/* Clear Filters & Counter */}
            <div className="flex items-center justify-between lg:justify-end gap-3 text-xs">
              <span className="font-semibold text-text-secondary">
                Showing {filteredAppointments.length} of {appointments.length}
              </span>
              {hasActiveFilters && (
                <button
                  data-testid="clear-filters-btn"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-border-strong text-primary font-semibold transition-colors"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Appointments Table / Empty States */}
          {appointments.length === 0 ? (
            <div
              data-testid="empty-customer-appointments"
              className="p-16 text-center bg-surface border border-border-strong rounded-3xl shadow-sm text-text-secondary"
            >
              <div className="w-16 h-16 rounded-2xl bg-surface-muted text-text-muted flex items-center justify-center mx-auto mb-4 border border-border-strong">
                <Calendar size={32} className="opacity-60" />
              </div>
              <h3 className="text-lg font-bold text-primary mb-1">No Appointment History</h3>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                This customer does not have any recorded appointments with your business yet.
              </p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div
              data-testid="empty-filtered-appointments"
              className="p-12 text-center bg-surface border border-border-strong rounded-3xl shadow-sm text-text-secondary"
            >
              <Search size={36} className="mx-auto mb-3 opacity-40 text-text-muted" />
              <h3 className="text-base font-bold text-primary mb-1">No Matching Appointments</h3>
              <p className="text-xs text-text-muted mb-4 max-w-sm mx-auto">
                No appointments matched your current search filters or date range.
              </p>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-all inline-flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="bg-surface rounded-3xl border border-border-strong overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" data-testid="appointments-history-table">
                  <thead className="bg-surface-muted/60 text-text-secondary font-semibold border-b border-border-strong text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Appointment ID</th>
                      <th className="px-5 py-3.5">Service</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Time</th>
                      <th className="px-5 py-3.5">Professional</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Price</th>
                      <th className="px-5 py-3.5">Booking Type</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-strong">
                    {filteredAppointments.map((appt) => {
                      const offline = isOfflineBooking(appt.customerNotes);
                      const staffName = appt.staff?.user
                        ? `${appt.staff.user.firstName} ${appt.staff.user.lastName}`
                        : "Unassigned";

                      return (
                        <tr
                          key={appt.id}
                          data-testid={`appointment-row-${appt.id}`}
                          className="hover:bg-surface-muted/30 transition-colors"
                        >
                          {/* ID */}
                          <td className="px-5 py-4 font-mono text-xs text-text-secondary whitespace-nowrap">
                            #{appt.id.slice(0, 8)}
                          </td>

                          {/* Service */}
                          <td className="px-5 py-4 font-semibold text-primary">
                            <div>{appt.serviceName}</div>
                            {appt.durationMins > 0 && (
                              <div className="text-[11px] font-normal text-text-muted flex items-center gap-1 mt-0.5">
                                <Clock size={11} />
                                {appt.durationMins} mins
                              </div>
                            )}
                          </td>

                          {/* Date */}
                          <td className="px-5 py-4 whitespace-nowrap text-text-secondary text-xs">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Calendar size={13} className="text-text-muted" />
                              {formatDisplayDate(appt.startTime)}
                            </div>
                          </td>

                          {/* Time */}
                          <td className="px-5 py-4 whitespace-nowrap text-text-secondary text-xs">
                            <div className="flex items-center gap-1.5">
                              <Clock size={13} className="text-text-muted" />
                              <span>
                                {getItemTimeString(appt.startTime)} - {getItemTimeString(appt.endTime)}
                              </span>
                            </div>
                          </td>

                          {/* Staff */}
                          <td className="px-5 py-4 whitespace-nowrap text-xs text-primary font-medium">
                            <div className="flex items-center gap-1.5">
                              <User size={13} className="text-text-muted" />
                              <span>{staffName}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            {getStatusBadge(appt.status)}
                          </td>

                          {/* Price */}
                          <td className="px-5 py-4 whitespace-nowrap font-bold text-primary text-xs">
                            {formatAudPrice(appt.price)}
                          </td>

                          {/* Booking Type */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            {offline ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Offline
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                Online
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => setSelectedAppointment(appt)}
                              data-testid={`view-details-btn-${appt.id}`}
                              className="px-3 py-1.5 bg-surface-muted hover:bg-border-strong text-primary text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1"
                            >
                              <FileText size={13} />
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Appointment Details Modal */}
          {selectedAppointment && (
            <div
              data-testid="appointment-details-modal"
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            >
              <div className="bg-surface rounded-3xl border border-border-strong w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Modal Header */}
                <div className="p-6 border-b border-border-strong flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Briefcase size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primary">Appointment Details</h3>
                      <p className="text-xs font-mono text-text-secondary">#{selectedAppointment.id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAppointment(null)}
                    data-testid="close-appointment-details-btn"
                    className="p-2 text-text-secondary hover:text-primary rounded-xl hover:bg-surface-muted transition-colors text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs sm:text-sm">
                  {/* Status & Price Highlight Banner */}
                  <div className="p-4 bg-surface-muted/60 rounded-2xl border border-border-strong flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary font-medium">Status:</span>
                      {getStatusBadge(selectedAppointment.status)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary font-medium">Booking Type:</span>
                      {isOfflineBooking(selectedAppointment.customerNotes) ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Offline Work
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          Online Booking
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary font-medium">Total Price:</span>
                      <span className="font-extrabold text-primary text-base">
                        {formatAudPrice(selectedAppointment.price)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Information Grid */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wider mb-2.5 flex items-center gap-1.5">
                      <User size={13} />
                      Customer Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-surface-muted/40 rounded-2xl border border-border-strong">
                      <div>
                        <div className="text-[11px] text-text-muted">Customer Name</div>
                        <div className="font-semibold text-primary mt-0.5">
                          {customer.firstName} {customer.lastName}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-text-muted">Email</div>
                        <div className="font-semibold text-primary mt-0.5 truncate">{customer.email}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-text-muted">Phone</div>
                        <div className="font-semibold text-primary mt-0.5">{customer.phone || "—"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Service & Staff Information Grid */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Briefcase size={13} />
                      Service & Staff
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-surface-muted/40 rounded-2xl border border-border-strong">
                      <div>
                        <div className="text-[11px] text-text-muted">Booked Service</div>
                        <div className="font-semibold text-primary text-sm mt-0.5">
                          {selectedAppointment.serviceName}
                        </div>
                        {selectedAppointment.durationMins > 0 && (
                          <div className="text-xs text-text-secondary mt-0.5">
                            Duration: {selectedAppointment.durationMins} minutes
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-[11px] text-text-muted">Assigned Professional</div>
                        <div className="font-semibold text-primary text-sm mt-0.5">
                          {selectedAppointment.staff?.user
                            ? `${selectedAppointment.staff.user.firstName} ${selectedAppointment.staff.user.lastName}`
                            : "Unassigned"}
                        </div>
                        {selectedAppointment.staff?.role && (
                          <div className="text-xs text-text-secondary mt-0.5 capitalize">
                            Role: {selectedAppointment.staff.role.replace(/_/g, " ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Date, Time & Location */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Calendar size={13} />
                      Schedule & Location
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-surface-muted/40 rounded-2xl border border-border-strong">
                      <div>
                        <div className="text-[11px] text-text-muted">Date</div>
                        <div className="font-semibold text-primary mt-0.5">
                          {formatDisplayDate(selectedAppointment.startTime)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-text-muted">Time Slot</div>
                        <div className="font-semibold text-primary mt-0.5">
                          {getItemTimeString(selectedAppointment.startTime)} -{" "}
                          {getItemTimeString(selectedAppointment.endTime)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-text-muted">Timezone</div>
                        <div className="font-semibold text-primary mt-0.5">
                          {selectedAppointment.timezone || "Australia/Sydney"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Notes / Job Notes */}
                  {selectedAppointment.customerNotes && (
                    <div>
                      <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wider mb-2.5 flex items-center gap-1.5">
                        <FileText size={13} />
                        Notes & Details
                      </h4>
                      <div className="p-4 bg-surface-muted/40 rounded-2xl border border-border-strong text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
                        {selectedAppointment.customerNotes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Pinned Footer */}
                <div className="p-4 sm:p-5 border-t border-border-strong bg-surface flex items-center justify-end shrink-0">
                  <button
                    onClick={() => setSelectedAppointment(null)}
                    className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
