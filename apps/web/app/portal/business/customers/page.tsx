"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/utils/api";
import { getAccessToken, getCurrentUser, getDashboardRouteForUser, buildAuthHeaders } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import {
  Loader2,
  Users,
  Search,
  Mail,
  Phone,
  Calendar,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react";
import { canUseBusinessCapability } from "@/utils/capabilities";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface CustomerItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  totalAppointments: number;
  lastAppointmentDate?: string;
  appointments: Array<{
    id: string;
    startTime: string;
    status: string;
    service?: {
      name: string;
    };
  }>;
}

export default function BusinessCustomersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/customers`,
        {
          headers: buildAuthHeaders(),
        },
      );
      if (!res.ok) throw new Error("Failed to fetch appointment customers");
      const data = await res.json();
      setCustomers(data);
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
      !canUseBusinessCapability(
        user.businessCategory as any,
        "APPOINTMENT_CUSTOMERS",
      )
    ) {
      router.replace(getDashboardRouteForUser(user));
      return;
    }
    fetchCustomers();
  }, [router]);

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    return (
      fullName.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appointment Customers"
        description="View client profiles, booking history, and contact details for your appointment business."
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-surface p-4 rounded-2xl border border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <input
            type="text"
            placeholder="Search by customer name, email or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-11 pl-9 pr-3 py-2 text-sm rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="text-xs font-semibold text-text-secondary shrink-0">
          Total Customers: {customers.length}
        </div>
      </div>

      {/* Customers Table / Mobile Cards */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border-strong rounded-2xl text-text-secondary">
          <Users size={40} className="mx-auto mb-3 opacity-60" />
          <h4 className="font-bold text-primary mb-1">No customers found</h4>
          <p className="text-xs text-text-muted">
            Clients who book appointments with your business will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Stacked Record Cards */}
          <div className="md:hidden space-y-3">
            {filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                className="bg-surface rounded-2xl border border-border-strong p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-primary text-base truncate">
                      {cust.firstName} {cust.lastName}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1 break-all">
                      <Mail size={13} className="shrink-0" />
                      <span>{cust.email}</span>
                    </div>
                    {cust.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                        <Phone size={13} className="shrink-0" />
                        <span>{cust.phone}</span>
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 px-2.5 py-1 bg-surface-muted border border-border-strong rounded-full text-xs font-bold text-primary">
                    {cust.totalAppointments}{" "}
                    {cust.totalAppointments === 1 ? "booking" : "bookings"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-strong/60">
                  <span className="text-xs text-text-secondary">
                    Last:{" "}
                    {cust.lastAppointmentDate
                      ? new Date(cust.lastAppointmentDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                  <Link
                    href={`/portal/business/customers/${cust.id}/history`}
                    data-testid={`customer-history-btn-mobile-${cust.id}`}
                    className="min-h-10 px-3.5 py-2 bg-surface-muted hover:bg-border-strong text-primary text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
                  >
                    <Eye size={14} />
                    View History
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-surface rounded-2xl border border-border-strong overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted/60 text-text-secondary font-semibold border-b border-border-strong text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Customer Name</th>
                  <th className="px-6 py-3">Email Address</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Total Appointments</th>
                  <th className="px-6 py-3">Last Appointment</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-strong">
                {filteredCustomers.map((cust) => (
                  <tr
                    key={cust.id}
                    className="hover:bg-surface-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold text-primary">
                      {cust.firstName} {cust.lastName}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <Mail size={13} />
                        {cust.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {cust.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone size={13} />
                          {cust.phone}
                        </div>
                      ) : (
                        <span className="text-text-muted italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-surface-muted border border-border-strong rounded-full text-xs font-bold text-primary">
                        {cust.totalAppointments}{" "}
                        {cust.totalAppointments === 1 ? "booking" : "bookings"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-text-secondary text-xs">
                      {cust.lastAppointmentDate
                        ? new Date(cust.lastAppointmentDate).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/portal/business/customers/${cust.id}/history`}
                        data-testid={`customer-history-btn-${cust.id}`}
                        className="px-3 py-1.5 bg-surface-muted hover:bg-border-strong text-primary text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 ml-auto"
                      >
                        <Eye size={13} />
                        History
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
