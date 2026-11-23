"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/utils/api";
import { getAccessToken, isAuthenticated } from "@/utils/auth";
import {
  MapPin,
  Plus,
  Loader2,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  Home,
  Briefcase,
  Building,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface CustomerAddress {
  id: string;
  label?: string;
  recipientName?: string;
  phone?: string;
  streetAddress: string;
  unitNumber?: string;
  suburb?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  instructions?: string;
  isDefault: boolean;
  createdAt?: string;
}

const AUSTRALIAN_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

export default function AddressesSettingsPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    label: "Home",
    recipientName: "",
    phone: "",
    unitNumber: "",
    streetAddress: "",
    suburb: "",
    city: "",
    state: "NSW",
    postcode: "",
    instructions: "",
    isDefault: false,
  });

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      if (!token) return;

      const res = await fetch(`${getApiUrl()}/api/v1/customer/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login?returnUrl=/settings/addresses");
          return;
        }
        throw new Error("Failed to load saved addresses");
      }

      const data = await res.json();
      setAddresses(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load addresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?returnUrl=/settings/addresses");
      return;
    }
    fetchAddresses();
  }, [router]);

  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setFormData({
      label: "Home",
      recipientName: "",
      phone: "",
      unitNumber: "",
      streetAddress: "",
      suburb: "",
      city: "",
      state: "NSW",
      postcode: "",
      instructions: "",
      isDefault: addresses.length === 0,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (addr: CustomerAddress) => {
    setEditingAddress(addr);
    setFormData({
      label: addr.label || "Home",
      recipientName: addr.recipientName || "",
      phone: addr.phone || "",
      unitNumber: addr.unitNumber || "",
      streetAddress: addr.streetAddress || "",
      suburb: addr.suburb || "",
      city: addr.city || "",
      state: addr.state || "NSW",
      postcode: addr.postcode || "",
      instructions: addr.instructions || "",
      isDefault: addr.isDefault || false,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      const token = getAccessToken();
      const isEdit = !!editingAddress;
      const url = isEdit
        ? `${getApiUrl()}/api/v1/customer/addresses/${editingAddress.id}`
        : `${getApiUrl()}/api/v1/customer/addresses`;
      const method = isEdit ? "PUT" : "POST";

      const payload = {
        label: formData.label.trim() || undefined,
        recipientName: formData.recipientName.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        unitNumber: formData.unitNumber.trim() || undefined,
        streetAddress: formData.streetAddress.trim(),
        suburb: formData.suburb.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        postcode: formData.postcode.trim(),
        country: "Australia",
        instructions: formData.instructions.trim() || undefined,
        isDefault: formData.isDefault,
      };

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
        throw new Error(errData.message || "Failed to save address");
      }

      setIsModalOpen(false);
      setSuccess(isEdit ? "Address updated successfully." : "Address added successfully.");
      setTimeout(() => setSuccess(null), 4000);
      await fetchAddresses();
    } catch (err: any) {
      setModalError(err.message || "An error occurred while saving the address");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this address?")) return;
    try {
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/api/v1/customer/addresses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to delete address");
      }
      setSuccess("Address removed.");
      setTimeout(() => setSuccess(null), 4000);
      await fetchAddresses();
    } catch (err: any) {
      alert(err.message || "Failed to delete address");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/api/v1/customer/addresses/${id}/default`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to set default address");
      }
      setSuccess("Default address updated.");
      setTimeout(() => setSuccess(null), 4000);
      await fetchAddresses();
    } catch (err: any) {
      alert(err.message || "Failed to update default address");
    }
  };

  const getLabelIcon = (label?: string) => {
    const l = (label || "").toLowerCase();
    if (l.includes("work") || l.includes("office")) return <Briefcase size={16} />;
    if (l.includes("apt") || l.includes("flat") || l.includes("unit")) return <Building size={16} />;
    return <Home size={16} />;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border-strong">
        <div>
          <h2 className="text-2xl font-bold text-primary">Saved Addresses</h2>
          <p className="text-sm text-text-secondary mt-1">
            Manage your service addresses for callout appointments, mobile mechanics, and home deliveries.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-bold hover:bg-brand-navy/90 transition-all shadow-sm shrink-0"
        >
          <Plus size={16} />
          Add Address
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-4 rounded-2xl bg-green-50 border border-green-200 text-green-800 text-sm font-semibold flex items-center gap-2">
          <CheckCircle size={18} className="text-green-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Address List */}
      {loading ? (
        <div className="flex items-center justify-center p-16 bg-surface rounded-2xl border border-border-strong">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-3xl border border-dashed border-border-strong p-8">
          <div className="w-16 h-16 rounded-full bg-accent/10 text-accent mx-auto flex items-center justify-center mb-4">
            <MapPin size={28} />
          </div>
          <h3 className="text-lg font-bold text-primary">No addresses saved yet</h3>
          <p className="text-text-secondary text-sm mt-1.5 max-w-sm mx-auto">
            Add your home or work address for quick booking when selecting customer-location or mobile services.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-all"
          >
            <Plus size={16} />
            Add First Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                addr.isDefault
                  ? "bg-accent/5 border-accent shadow-sm"
                  : "bg-surface border-border-strong hover:border-text-secondary/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-muted text-primary border border-border-strong/60">
                    {getLabelIcon(addr.label)}
                    {addr.label || "Address"}
                  </span>
                  {addr.isDefault ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                      <Star size={11} className="fill-accent text-accent" />
                      Default
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-xs text-text-secondary hover:text-accent font-semibold transition-colors"
                    >
                      Set as Default
                    </button>
                  )}
                </div>

                <div className="text-primary font-bold text-base mt-2">
                  {addr.unitNumber ? `${addr.unitNumber}/` : ""}
                  {addr.streetAddress}
                </div>
                <div className="text-xs text-text-secondary mt-0.5 font-medium">
                  {[addr.suburb || addr.city, addr.state, addr.postcode].filter(Boolean).join(" ")}
                </div>

                {(addr.recipientName || addr.phone) && (
                  <div className="text-xs text-text-secondary mt-2 pt-2 border-t border-border-strong/50">
                    <span className="font-semibold text-primary">{addr.recipientName || "Contact"}:</span>{" "}
                    {addr.phone || "No phone provided"}
                  </div>
                )}

                {addr.instructions && (
                  <div className="mt-2.5 p-2 bg-amber-50/70 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 leading-snug">
                    <span className="font-bold">Access Notes:</span> {addr.instructions}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 mt-3 border-t border-border-strong/50">
                <button
                  onClick={() => handleOpenEditModal(addr)}
                  className="p-1.5 text-text-secondary hover:text-primary rounded-lg hover:bg-surface-muted text-xs font-semibold inline-flex items-center gap-1"
                  title="Edit Address"
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(addr.id)}
                  className="p-1.5 text-text-secondary hover:text-rose-600 rounded-lg hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1"
                  title="Delete Address"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-border-strong">
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Modal Header (Pinned) */}
              <div className="shrink-0 px-6 py-5 md:px-8 border-b border-border-strong flex items-start justify-between bg-surface">
                <div>
                  <h3 className="text-xl font-bold text-primary">
                    {editingAddress ? "Edit Saved Address" : "Add New Address"}
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Configure recipient details and service fulfillment location.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-surface-muted transition-colors"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}
              {/* Address Label Presets */}
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Address Label
                </label>
                <div className="flex gap-2">
                  {["Home", "Work", "Office", "Other"].map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setFormData({ ...formData, label: lbl })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        formData.label.toLowerCase() === lbl.toLowerCase()
                          ? "bg-brand-navy text-white border-brand-navy"
                          : "bg-surface-muted text-text-secondary border-border-strong hover:text-primary"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Contact / Recipient Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={formData.recipientName}
                    onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0400 000 000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Unit & Street */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Unit / Apt #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 4B"
                    value={formData.unitNumber}
                    onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 123 George St"
                    value={formData.streetAddress}
                    onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Suburb / City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Suburb / Locality
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. The Rocks"
                    value={formData.suburb}
                    onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sydney"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* State & Postcode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    State *
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
                  >
                    {AUSTRALIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Postcode *
                  </label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{4}"
                    placeholder="e.g. 2000"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Access Instructions */}
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Delivery / Access / Parking Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Security buzzer #12, park in visitor bay 3, or driveway access..."
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Default checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefaultAddr"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 text-accent rounded border-border-strong"
                />
                <label htmlFor="isDefaultAddr" className="text-xs font-semibold text-primary">
                  Set as my primary default service address
                </label>
              </div>

              </div>

              {/* Modal Footer (Pinned & Accessible) */}
              <div className="shrink-0 bg-surface border-t border-border-strong px-6 md:px-8 py-4 flex items-center justify-end gap-3 z-10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-border-strong text-text-secondary hover:text-primary text-sm font-semibold hover:bg-surface-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-bold hover:bg-brand-navy/90 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{editingAddress ? "Saving Changes..." : "Adding Address..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>{editingAddress ? "Save Changes" : "Add Address"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
