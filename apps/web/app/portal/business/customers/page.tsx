"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/utils/api";
import { getAccessToken, getCurrentUser } from "@/utils/auth";
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
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(
    null,
  );

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/customers`,
        {
          headers: { Authorization: `Bearer ${token}` },
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
      !user ||
      !canUseBusinessCapability(
        user.businessCategory as any,
        "APPOINTMENT_CUSTOMERS",
      )
    ) {
      router.replace("/portal");
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
      <div className="bg-surface p-4 rounded-2xl border border-border-strong flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <input
            type="text"
            placeholder="Search by customer name, email or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="text-xs font-semibold text-text-secondary">
          Total Customers: {customers.length}
        </div>
      </div>

      {/* Customers Table */}
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
        <div className="bg-surface rounded-2xl border border-border-strong overflow-hidden shadow-sm">
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
                      <button
                        onClick={() => setSelectedCustomer(cust)}
                        className="px-3 py-1.5 bg-surface-muted hover:bg-border-strong text-primary text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Eye size={13} />
                        History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Booking History Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-primary">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </h3>
                <div className="text-xs text-text-secondary mt-1">
                  {selectedCustomer.email}{" "}
                  {selectedCustomer.phone && `• ${selectedCustomer.phone}`}
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-text-secondary hover:text-primary text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wider mb-3">
                Appointment History ({selectedCustomer.appointments.length})
              </h4>
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {selectedCustomer.appointments.length === 0 ? (
                  <div className="text-sm text-text-secondary italic p-4 bg-surface-muted rounded-xl">
                    No bookings found.
                  </div>
                ) : (
                  selectedCustomer.appointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="p-3 bg-surface-muted/60 border border-border-strong/60 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-primary text-sm">
                          {appt.service?.name || "Appointment"}
                        </div>
                        <div className="text-text-secondary mt-0.5 flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(appt.startTime).toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          appt.status === "CONFIRMED"
                            ? "bg-green-100 text-green-700"
                            : appt.status === "PENDING_APPROVAL"
                              ? "bg-amber-100 text-amber-700"
                              : appt.status === "COMPLETED"
                                ? "bg-teal-100 text-teal-700"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {appt.status.replace("_", " ")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border-strong flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl hover:bg-brand-navy/90"
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
