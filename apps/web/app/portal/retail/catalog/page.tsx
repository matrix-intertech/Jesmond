"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export default function CatalogPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    sellingPrice: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const openCreateModal = () => {
    setFormData({ sku: '', name: '', sellingPrice: '' });
    setFormError("");
    setFormSuccess("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    setFormSuccess("");
    
    const token = getAccessToken();
    if (!token) return;
    
    try {
      const payload = {
        sku: formData.sku,
        name: formData.name,
        sellingPrice: Math.round(parseFloat(formData.sellingPrice) * 100) // Convert to cents
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/catalog/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setFormSuccess("Product created successfully! Since product listing is not supported by the backend, it will not appear below.");
        setTimeout(() => setIsModalOpen(false), 3000);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setFormError(errJson.message || 'Operation failed');
        if (res.status === 401) {
          clearAuth();
          router.replace('/login');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Network error');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Catalog" description="Manage retail products and categories." />
        <button onClick={openCreateModal} className="bg-brand-navy hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Add Product
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-3 flex gap-4">
          <button className="text-brand-orange font-medium border-b-2 border-brand-orange pb-1">Products</button>
          <button className="text-slate-500 hover:text-slate-700 pb-1 cursor-not-allowed opacity-50" title="Categories API not available">Categories</button>
        </div>
        <div className="p-12">
          <EmptyState 
            title="Product Listing API Not Available" 
            description="The backend contract currently only supports creating products, not fetching them. Any created products will be saved in the database but cannot be displayed here." 
          />
          <div className="mt-4 flex justify-center">
            <button onClick={openCreateModal} className="px-4 py-2 rounded-md bg-brand-navy text-white hover:bg-brand-navy/90 transition">
              Create Product Anyway
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-semibold text-lg text-brand-navy">Add Product</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-rose-50 text-rose-700 rounded text-sm">{formError}</div>}
              {formSuccess && <div className="p-3 bg-emerald-50 text-emerald-700 rounded text-sm">{formSuccess}</div>}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm" placeholder="e.g. Jesmond T-Shirt" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input required type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm font-mono" placeholder="e.g. TSHIRT-BLK-L" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price ($)</label>
                <input required type="number" step="0.01" min="0" value={formData.sellingPrice} onChange={e => setFormData({...formData, sellingPrice: e.target.value})} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm" placeholder="25.00" />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm font-medium text-white bg-brand-orange hover:bg-orange-600 rounded-md disabled:opacity-50">
                  {formLoading ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
