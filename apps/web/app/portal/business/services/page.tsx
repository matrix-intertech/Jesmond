"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/utils/api";
import { getAccessToken, getCurrentUser } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import {
  Loader2,
  Plus,
  Clock,
  DollarSign,
  Tag,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  FolderPlus,
  Layers,
  Settings,
  X,
  HelpCircle,
} from "lucide-react";
import { canUseBusinessCapability } from "@/utils/capabilities";
import { useRouter } from "next/navigation";

interface ServiceCategoryItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    services?: number;
  };
}

interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  durationMins?: number;
  durationMinutes?: number;
  price?: number | string;
  isActive: boolean;
  branchId?: string;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    isActive: boolean;
  } | null;
}

export default function BusinessServicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<ServiceCategoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Service Modal state
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategoryItem | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null);

  // Service Form state
  const [serviceFormData, setServiceFormData] = useState({
    name: "",
    description: "",
    durationMinutes: 30,
    price: 60,
    isActive: true,
    categoryId: "" as string,
  });

  // Category Form state
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
    isActive: true,
  });

  // Selected Category filter ("ALL", "UNCATEGORIZED", or categoryId)
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();

      // Fetch services & categories in parallel
      const [servicesRes, categoriesRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/v1/business-appointments/services`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiUrl()}/api/v1/business-appointments/categories?includeInactive=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!servicesRes.ok) throw new Error("Failed to fetch services catalogue");
      if (!categoriesRes.ok) throw new Error("Failed to fetch service categories");

      const servicesData = await servicesRes.json();
      const categoriesData = await categoriesRes.json();

      setServices(servicesData);
      setCategories(categoriesData);
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
        "APPOINTMENT_SERVICES",
      )
    ) {
      router.replace("/portal");
      return;
    }
    fetchData();
  }, [router]);

  // Open Service Modal
  const handleOpenCreateServiceModal = (preferredCategoryId?: string) => {
    setEditingService(null);
    setServiceFormData({
      name: "",
      description: "",
      durationMinutes: 30,
      price: 60,
      isActive: true,
      categoryId: preferredCategoryId || (categories[0]?.id ?? ""),
    });
    setIsServiceModalOpen(true);
  };

  const handleOpenEditServiceModal = (service: ServiceItem) => {
    setEditingService(service);
    const duration = service.durationMins ?? service.durationMinutes ?? 30;
    // backend price is in cents if returned as integer
    const priceAud =
      service.price !== undefined
        ? Number(service.price) > 500
          ? Number(service.price) / 100
          : Number(service.price)
        : 0;

    setServiceFormData({
      name: service.name,
      description: service.description || "",
      durationMinutes: duration,
      price: priceAud,
      isActive: service.isActive,
      categoryId: service.categoryId || "",
    });
    setIsServiceModalOpen(true);
  };

  // Submit Service (Create/Update)
  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setServiceSubmitting(true);
      const token = getAccessToken();
      const isEdit = !!editingService;
      const url = isEdit
        ? `${getApiUrl()}/api/v1/business-appointments/services/${editingService.id}`
        : `${getApiUrl()}/api/v1/business-appointments/services`;

      const method = isEdit ? "PUT" : "POST";

      const payload = {
        name: serviceFormData.name.trim(),
        description: serviceFormData.description.trim() || undefined,
        durationMins: Number(serviceFormData.durationMinutes),
        price: Math.round(Number(serviceFormData.price) * 100), // convert AUD dollars to cents
        isActive: serviceFormData.isActive,
        categoryId: serviceFormData.categoryId ? serviceFormData.categoryId : null,
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
        const errData = await res.json();
        throw new Error(errData.message || "Failed to save service");
      }

      setIsServiceModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setServiceSubmitting(false);
    }
  };

  // Delete / Deactivate Service
  const handleDeleteService = async (service: ServiceItem) => {
    const demoNames = [
      "General Consultation",
      "Extended Consultation",
      "Vehicle Inspection",
      "Logbook Service",
    ];
    if (demoNames.includes(service.name)) {
      alert("This standard seeded demo service cannot be deactivated or deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to deactivate "${service.name}"?`))
      return;

    try {
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/services/${service.id}/delete`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to deactivate service");
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Open Category Management Modal
  const handleOpenCreateCategoryModal = () => {
    setEditingCategory(null);
    setCategoryFormData({
      name: "",
      description: "",
      isActive: true,
    });
    setCategoryModalError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategoryModal = (cat: ServiceCategoryItem) => {
    setEditingCategory(cat);
    setCategoryFormData({
      name: cat.name,
      description: cat.description || "",
      isActive: cat.isActive,
    });
    setCategoryModalError(null);
    setIsCategoryModalOpen(true);
  };

  // Submit Category (Create/Update)
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCategorySubmitting(true);
      setCategoryModalError(null);
      const token = getAccessToken();
      const isEdit = !!editingCategory;
      const url = isEdit
        ? `${getApiUrl()}/api/v1/business-appointments/categories/${editingCategory.id}`
        : `${getApiUrl()}/api/v1/business-appointments/categories`;

      const method = isEdit ? "PUT" : "POST";

      const payload = {
        name: categoryFormData.name.trim(),
        description: categoryFormData.description.trim() || undefined,
        isActive: categoryFormData.isActive,
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
        const errData = await res.json();
        throw new Error(errData.message || "Failed to save category");
      }

      setIsCategoryModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setCategoryModalError(err.message);
    } finally {
      setCategorySubmitting(false);
    }
  };

  // Safe Delete Category
  const handleDeleteCategory = async (cat: ServiceCategoryItem) => {
    // Check if category has dependent services
    const count = services.filter((s) => s.categoryId === cat.id).length;
    if (count > 0) {
      alert(
        `Cannot delete category "${cat.name}" because ${count} service(s) are currently assigned to it. Please reassign or unassign those services first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
      return;
    }

    try {
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/categories/${cat.id}/delete`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to delete category");
      }

      if (selectedFilter === cat.id) {
        setSelectedFilter("ALL");
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Quick Unassign Category
  const handleQuickUnassignCategory = async (service: ServiceItem) => {
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${getApiUrl()}/api/v1/business-appointments/services/${service.id}/category`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ categoryId: null }),
        },
      );
      if (!res.ok) throw new Error("Failed to remove category assignment");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtered Services
  const filteredServices = services.filter((s) => {
    if (selectedFilter === "ALL") return true;
    if (selectedFilter === "UNCATEGORIZED") return !s.categoryId;
    return s.categoryId === selectedFilter;
  });

  const uncategorizedCount = services.filter((s) => !s.categoryId).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Services Catalogue"
          description="Manage your database-backed service categories and bookable appointment offerings."
        />
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenCreateCategoryModal()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-surface border border-border-strong text-text-primary text-sm font-bold rounded-xl hover:bg-surface-muted transition-colors shadow-sm"
          >
            <FolderPlus size={17} className="text-accent" />
            New Category
          </button>
          <button
            onClick={() =>
              handleOpenCreateServiceModal(
                selectedFilter !== "ALL" && selectedFilter !== "UNCATEGORIZED"
                  ? selectedFilter
                  : undefined
              )
            }
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-navy text-white text-sm font-bold rounded-xl hover:bg-brand-navy/90 shadow-sm transition-colors"
          >
            <Plus size={18} />
            Add Service
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Categories Toolbar & Filter Tabs */}
      <div className="bg-surface rounded-2xl border border-border-strong p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-strong/50 pb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-accent" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Filter by Category
            </span>
          </div>
          <span className="text-xs text-text-muted">
            {categories.length} total categories registered
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* All */}
          <button
            onClick={() => setSelectedFilter("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              selectedFilter === "ALL"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface-muted border border-border-strong text-text-secondary hover:text-primary"
            }`}
          >
            All Services ({services.length})
          </button>

          {/* Database Categories */}
          {categories.map((cat) => {
            const count = services.filter((s) => s.categoryId === cat.id).length;
            const isSelected = selectedFilter === cat.id;
            return (
              <div
                key={cat.id}
                className={`flex items-center rounded-xl border text-xs font-bold transition-colors ${
                  isSelected
                    ? "bg-accent text-white border-accent shadow-sm"
                    : "bg-surface-muted border-border-strong text-text-secondary hover:text-primary"
                }`}
              >
                <button
                  onClick={() => setSelectedFilter(cat.id)}
                  className="px-3 py-1.5 flex items-center gap-1.5"
                >
                  <span>{cat.name}</span>
                  {!cat.isActive && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                        isSelected ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      Inactive
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isSelected ? "bg-white/20 text-white" : "bg-black/5 text-text-muted"
                    }`}
                  >
                    {count}
                  </span>
                </button>
                <div className="flex items-center pr-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditCategoryModal(cat);
                    }}
                    title="Edit Category"
                    className={`p-1 rounded hover:bg-black/10 transition-colors ${
                      isSelected ? "text-white" : "text-text-muted hover:text-primary"
                    }`}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(cat);
                    }}
                    title="Delete Category"
                    className={`p-1 rounded hover:bg-red-500/20 transition-colors ${
                      isSelected ? "text-white hover:text-red-200" : "text-text-muted hover:text-red-600"
                    }`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Uncategorized Services Group */}
          <button
            onClick={() => setSelectedFilter("UNCATEGORIZED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
              selectedFilter === "UNCATEGORIZED"
                ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                : "bg-amber-50/50 border-amber-200 text-amber-800 hover:bg-amber-100/50"
            }`}
          >
            Uncategorized ({uncategorizedCount})
          </button>
        </div>
      </div>

      {/* Services List / Cards */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border-strong rounded-2xl text-text-secondary">
          <Layers size={40} className="mx-auto mb-3 opacity-60" />
          <h4 className="font-bold text-primary mb-1">No services found</h4>
          <p className="text-xs text-text-muted mb-4">
            {selectedFilter === "UNCATEGORIZED"
              ? "All active services are currently assigned to a category."
              : selectedFilter !== "ALL"
              ? "There are no services assigned to this category."
              : "Create bookable service offerings for your customers."}
          </p>
          <button
            onClick={() =>
              handleOpenCreateServiceModal(
                selectedFilter !== "ALL" && selectedFilter !== "UNCATEGORIZED"
                  ? selectedFilter
                  : undefined
              )
            }
            className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl"
          >
            Add Service to this Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => {
            const categoryObj = categories.find((c) => c.id === service.categoryId) || service.category;
            const duration = service.durationMins ?? service.durationMinutes ?? 30;
            const priceAud =
              service.price !== undefined
                ? Number(service.price) > 500
                  ? Number(service.price) / 100
                  : Number(service.price)
                : 0;

            return (
              <div
                key={service.id}
                className="bg-surface rounded-2xl border border-border-strong p-6 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    {categoryObj ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-surface-muted text-text-secondary border border-border-strong/50">
                        <Tag size={11} className="text-accent" />
                        {categoryObj.name}
                        {!categoryObj.isActive && (
                          <span className="text-[9px] text-amber-700 bg-amber-100 px-1 rounded ml-1">
                            inactive cat
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <HelpCircle size={11} />
                        Uncategorized
                      </span>
                    )}

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        service.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {service.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-primary mb-1">
                    {service.name}
                  </h3>
                  <p className="text-xs text-text-secondary line-clamp-2 mb-4">
                    {service.description || "Professional appointment service."}
                  </p>
                </div>

                <div className="pt-4 border-t border-border-strong/60 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-semibold text-text-secondary">
                    <span className="flex items-center gap-1 text-primary">
                      <Clock size={13} className="text-accent" />
                      {duration} min
                    </span>
                    <span className="flex items-center gap-1 text-primary font-bold">
                      <DollarSign size={13} className="text-green-600" />
                      AUD ${priceAud.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {service.categoryId && (
                      <button
                        onClick={() => handleQuickUnassignCategory(service)}
                        className="p-1.5 text-text-muted hover:text-amber-700 rounded-lg hover:bg-amber-50 text-[11px] font-medium"
                        title="Unassign from category"
                      >
                        <X size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEditServiceModal(service)}
                      className="p-1.5 text-text-secondary hover:text-primary rounded-lg hover:bg-surface-muted"
                      title="Edit Service"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteService(service)}
                      className="p-1.5 text-text-secondary hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="Deactivate Service"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Service Modal (Create / Edit) */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold text-primary mb-1">
              {editingService ? "Edit Bookable Service" : "Add New Service"}
            </h2>
            <p className="text-xs text-text-secondary mb-6">
              Configure service details, duration, AUD price, and persistent category.
            </p>

            <form onSubmit={handleServiceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electrical Safety Inspection"
                  value={serviceFormData.name}
                  onChange={(e) =>
                    setServiceFormData({ ...serviceFormData, name: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Category (Optional)
                </label>
                <select
                  value={serviceFormData.categoryId}
                  onChange={(e) =>
                    setServiceFormData({
                      ...serviceFormData,
                      categoryId: e.target.value,
                    })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
                >
                  <option value="">-- No Category (Uncategorized) --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isActive ? "" : "(Inactive)"}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-text-muted mt-1">
                  Categories can be created and managed via the "New Category" button.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    required
                    value={serviceFormData.durationMinutes}
                    onChange={(e) =>
                      setServiceFormData({
                        ...serviceFormData,
                        durationMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Price (AUD) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={serviceFormData.price}
                    onChange={(e) =>
                      setServiceFormData({
                        ...serviceFormData,
                        price: Number(e.target.value),
                      })
                    }
                    className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the scope of work included in this service..."
                  value={serviceFormData.description}
                  onChange={(e) =>
                    setServiceFormData({
                      ...serviceFormData,
                      description: e.target.value,
                    })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="serviceActiveCheck"
                  checked={serviceFormData.isActive}
                  onChange={(e) =>
                    setServiceFormData({
                      ...serviceFormData,
                      isActive: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-accent rounded border-border-strong"
                />
                <label
                  htmlFor="serviceActiveCheck"
                  className="text-sm font-semibold text-primary"
                >
                  Available for booking (Active status)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-border-strong">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-strong text-text-secondary hover:text-primary text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={serviceSubmitting}
                  className="px-6 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-bold hover:bg-brand-navy/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {serviceSubmitting && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  {editingService ? "Save Changes" : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal (Create / Edit) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-primary mb-1">
              {editingCategory ? "Edit Category" : "New Service Category"}
            </h2>
            <p className="text-xs text-text-secondary mb-5">
              Categories help organize your appointment catalogue (e.g. Electrical, Plumbing, Carpentry, Consultation, Inspection, Maintenance).
            </p>

            {categoryModalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} />
                {categoryModalError}
              </div>
            )}

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electrical, Carpentry, Maintenance"
                  value={categoryFormData.name}
                  onChange={(e) =>
                    setCategoryFormData({ ...categoryFormData, name: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional description of this service category..."
                  value={categoryFormData.description}
                  onChange={(e) =>
                    setCategoryFormData({
                      ...categoryFormData,
                      description: e.target.value,
                    })
                  }
                  className="w-full p-3 rounded-xl border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="categoryActiveCheck"
                  checked={categoryFormData.isActive}
                  onChange={(e) =>
                    setCategoryFormData({
                      ...categoryFormData,
                      isActive: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-accent rounded border-border-strong"
                />
                <label
                  htmlFor="categoryActiveCheck"
                  className="text-sm font-semibold text-primary"
                >
                  Active category
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-border-strong">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-strong text-text-secondary hover:text-primary text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={categorySubmitting}
                  className="px-6 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-bold hover:bg-brand-navy/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {categorySubmitting && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  {editingCategory ? "Save Changes" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
