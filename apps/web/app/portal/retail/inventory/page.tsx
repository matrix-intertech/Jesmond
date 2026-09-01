"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  category: Category | null;
  barcode: string | null;
}

interface InventoryItem {
  id: string;
  branchId: string;
  productId: string;
  quantity: number;
  product: Product;
  updatedAt: string;
}

export default function InventoryWorkspace() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // App context
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");

  // Drawer / Adjustment Modal
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjType, setAdjType] = useState<"ADD" | "REMOVE">("ADD");
  const [adjQty, setAdjQty] = useState("1");
  const [adjReason, setAdjReason] = useState("");
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjError, setAdjError] = useState("");
  const [adjSuccess, setAdjSuccess] = useState("");

  const fetchInventory = async (branch: string) => {
    if (!branch) return;
    setLoading(true);
    setError("");
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/inventory/${branch}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to fetch inventory');
        if (res.status === 401) {
          clearAuth();
          router.replace('/login');
        }
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
        if (data.length > 0) {
          setBranchId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load branches', e);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (branchId) {
      fetchInventory(branchId);
    }
  }, [branchId]);

  // Derived KPI and filtered data
  const { totalUnits, lowStockCount, outOfStockCount, filteredItems } = useMemo(() => {
    let units = 0;
    let low = 0;
    let out = 0;

    inventory.forEach(item => {
      units += item.quantity;
      if (item.quantity === 0) out++;
      else if (item.quantity > 0 && item.quantity <= 10) low++; // Business rule assumption for UI: <= 10 is low
    });

    let filtered = inventory.filter(item => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!item.product.name.toLowerCase().includes(q) &&
            !item.product.sku.toLowerCase().includes(q) &&
            !(item.product.barcode && item.product.barcode.toLowerCase().includes(q))) {
          return false;
        }
      }
      // Stock Filter
      if (stockFilter === "IN_STOCK" && item.quantity <= 0) return false;
      if (stockFilter === "OUT_OF_STOCK" && item.quantity > 0) return false;
      if (stockFilter === "LOW_STOCK" && (item.quantity <= 0 || item.quantity > 10)) return false;

      return true;
    });

    return { totalUnits: units, lowStockCount: low, outOfStockCount: out, filteredItems: filtered };
  }, [inventory, searchQuery, stockFilter]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const qty = parseInt(adjQty);
    if (isNaN(qty) || qty <= 0) return;

    const actualQty = adjType === "ADD" ? qty : -qty;

    setAdjLoading(true);
    setAdjError("");
    setAdjSuccess("");

    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/inventory/${branchId}/${selectedItem.productId}/adjust`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantity: actualQty, reason: adjReason || "Manual Adjustment" })
      });

      if (res.ok) {
        const updatedItem = await res.json();
        setAdjSuccess(`Stock updated! Previous: ${selectedItem.quantity}, New: ${updatedItem.quantity}`);
        // Optimistic UI update
        setInventory(prev => prev.map(item => item.productId === selectedItem.productId ? { ...item, quantity: updatedItem.quantity, updatedAt: updatedItem.updatedAt } : item));

        setTimeout(() => {
          setIsAdjusting(false);
          setSelectedItem(null);
          setAdjSuccess("");
        }, 2000);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setAdjError(errJson.message || 'Adjustment failed');
      }
    } catch (err: any) {
      setAdjError(err.message || 'Network error');
    } finally {
      setAdjLoading(false);
    }
  };

  const healthyPercentage = inventory.length > 0
    ? Math.round(((inventory.length - lowStockCount - outOfStockCount) / inventory.length) * 100)
    : 100;

  return (
    <div className="space-y-6 bg-slate-50 min-h-[calc(100vh-80px)] p-6 -m-2">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <PageHeader
          title="Inventory"
          description="Manage stock levels, track movements, and optimize retail operations."
        />
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2 shadow-sm">
            <span className="text-sm font-medium text-slate-500">Inventory for:</span>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="text-sm font-semibold text-brand-navy border-none bg-transparent focus:ring-0 p-0 cursor-pointer"
            >
              {branches.length === 0 ? (
                <option value="">No branches found...</option>
              ) : (
                branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))
              )}
            </select>
          </div>
          <button onClick={() => fetchInventory(branchId)} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm text-slate-600 transition" title="Refresh">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-100 flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Products" value={loading ? "-" : inventory.length} loading={loading} />
            <StatCard label="Total Units" value={loading ? "-" : totalUnits} loading={loading} />
            <StatCard label="Low Stock" value={loading ? "-" : lowStockCount} loading={loading} />
            <StatCard label="Healthy" value={loading ? "-" : `${healthyPercentage}%`} loading={loading} />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
              <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search product, SKU or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm text-slate-800 bg-white"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                {(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setStockFilter(filter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      stockFilter === filter
                        ? 'bg-brand-navy text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              {loading ? (
                <div className="p-8 space-y-4">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    </div>
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-brand-navy mb-1">Your inventory is empty</h3>
                  <p className="text-slate-500 max-w-sm mb-6">Create products in Catalog to begin tracking stock, or adjust your search filters.</p>
                  <button onClick={() => router.push('/portal/retail/catalog')} className="px-4 py-2 bg-brand-navy text-white font-medium rounded-lg hover:bg-slate-800 transition">
                    Go to Catalog
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <table className="hidden md:table min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Product</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Stock Level</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {filteredItems.map((item) => {
                        const isOutOfStock = item.quantity <= 0;
                        const isLowStock = !isOutOfStock && item.quantity <= 10;

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${isOutOfStock ? 'bg-rose-50/30' : ''}`}
                            onClick={() => setSelectedItem(item)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-semibold text-brand-navy">{item.product.name}</span>
                                <span className="text-xs font-mono text-slate-500">{item.product.sku}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-slate-600">{item.product.category?.name || 'Uncategorized'}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <span className={`text-lg font-bold w-8 text-right ${isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {item.quantity}
                                </span>
                                <div className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className={`h-full ${isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, (item.quantity / 50) * 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                isOutOfStock ? 'bg-rose-100 text-rose-800' :
                                isLowStock ? 'bg-amber-100 text-amber-800' :
                                'bg-emerald-100 text-emerald-800'
                              }`}>
                                {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setIsAdjusting(true); }}
                                className="text-brand-orange hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition"
                              >
                                Adjust
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Mobile Stacked Cards */}
                  <div className="md:hidden flex flex-col divide-y divide-slate-100">
                    {filteredItems.map((item) => {
                      const isOutOfStock = item.quantity <= 0;
                      const isLowStock = !isOutOfStock && item.quantity <= 10;

                      return (
                        <div
                          key={`mobile-${item.id}`}
                          className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${isOutOfStock ? 'bg-rose-50/30' : ''}`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                              <span className="font-semibold text-brand-navy">{item.product.name}</span>
                              <span className="text-xs font-mono text-slate-500">{item.product.sku}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                              isOutOfStock ? 'bg-rose-100 text-rose-800' :
                              isLowStock ? 'bg-amber-100 text-amber-800' :
                              'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                            </span>
                          </div>

                          <div className="flex justify-between items-end mt-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-500 mb-1">Stock Level</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-lg font-bold ${isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {item.quantity}
                                </span>
                                <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className={`h-full ${isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, (item.quantity / 50) * 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setIsAdjusting(true); }}
                              className="text-brand-orange font-medium bg-orange-50 px-3 py-1.5 rounded-lg text-sm"
                            >
                              Adjust
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Detail / Adjust Drawer/Modal Overlay */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-brand-navy mb-1">{selectedItem.product.name}</h2>
                <div className="flex items-center gap-2 text-sm text-slate-500 font-mono">
                  <span>{selectedItem.product.sku}</span>
                  {selectedItem.product.barcode && (
                    <>
                      <span>•</span>
                      <span>{selectedItem.product.barcode}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setSelectedItem(null); setIsAdjusting(false); setAdjSuccess(""); setAdjError(""); }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-sm font-medium text-slate-500">Current Stock</span>
                <span className={`text-3xl font-black ${selectedItem.quantity <= 0 ? 'text-rose-600' : selectedItem.quantity <= 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {selectedItem.quantity}
                </span>
              </div>

              {!isAdjusting ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-brand-navy mb-2 uppercase tracking-wider">Product Info</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Category</span>
                        <span className="font-medium text-slate-800">{selectedItem.product.category?.name || 'Uncategorized'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Selling Price</span>
                        <span className="font-medium text-slate-800">${(selectedItem.product.sellingPrice / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Last Updated</span>
                        <span className="font-medium text-slate-800">{new Date(selectedItem.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                    <h4 className="text-sm font-semibold text-brand-orange mb-1">Need to modify stock?</h4>
                    <p className="text-xs text-orange-800 mb-3">Record a manual stock adjustment, return, or damage claim.</p>
                    <button
                      onClick={() => setIsAdjusting(true)}
                      className="w-full py-2 bg-brand-orange text-white font-medium rounded-lg hover:bg-orange-600 transition shadow-sm"
                    >
                      Adjust Stock
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAdjustSubmit} className="space-y-6">
                  {adjSuccess ? (
                    <div className="bg-emerald-50 text-emerald-800 p-6 rounded-xl border border-emerald-200 text-center space-y-2 animate-in zoom-in duration-300">
                      <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h4 className="font-bold text-lg">Stock Updated</h4>
                      <p className="text-sm">{adjSuccess}</p>
                    </div>
                  ) : (
                    <>
                      {adjError && (
                        <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm border border-rose-100">
                          {adjError}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Adjustment Type</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setAdjType("ADD")}
                              className={`py-2 px-4 text-sm font-medium rounded-lg border transition-colors ${adjType === "ADD" ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
                              Add Stock
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdjType("REMOVE")}
                              className={`py-2 px-4 text-sm font-medium rounded-lg border transition-colors ${adjType === "REMOVE" ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
                              Remove Stock
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Quantity to {adjType === "ADD" ? "Add" : "Remove"}</label>
                          <input
                            required
                            type="number"
                            min="1"
                            value={adjQty}
                            onChange={e => setAdjQty(e.target.value)}
                            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                          <select
                            required
                            value={adjReason}
                            onChange={e => setAdjReason(e.target.value)}
                            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm"
                          >
                            <option value="">Select a reason...</option>
                            {adjType === "ADD" ? (
                              <>
                                <option value="STOCK_RECEIPT">Stock Receipt (New Delivery)</option>
                                <option value="RETURN">Customer Return</option>
                                <option value="INVENTORY_COUNT">Inventory Count Correction</option>
                              </>
                            ) : (
                              <>
                                <option value="DAMAGE">Damaged / Spoiled</option>
                                <option value="THEFT">Theft / Loss</option>
                                <option value="INVENTORY_COUNT">Inventory Count Correction</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>

                      <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-slate-500">Current</span>
                          <span className="font-medium">{selectedItem.quantity}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm mb-1 text-slate-500">
                          <span>Adjustment</span>
                          <span>{adjType === "ADD" ? "+" : "-"}{parseInt(adjQty) || 0}</span>
                        </div>
                        <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center font-bold">
                          <span className="text-slate-800">Projected Stock</span>
                          <span className={((selectedItem.quantity) + (adjType === "ADD" ? (parseInt(adjQty)||0) : -(parseInt(adjQty)||0))) < 0 ? 'text-rose-600' : 'text-brand-navy'}>
                            {(selectedItem.quantity) + (adjType === "ADD" ? (parseInt(adjQty)||0) : -(parseInt(adjQty)||0))}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsAdjusting(false)}
                          className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={adjLoading || ((selectedItem.quantity) + (adjType === "ADD" ? (parseInt(adjQty)||0) : -(parseInt(adjQty)||0))) < 0}
                          className="flex-1 py-2.5 bg-brand-orange text-white font-medium rounded-lg hover:bg-orange-600 transition disabled:opacity-50 shadow-sm"
                        >
                          {adjLoading ? 'Applying...' : 'Apply Adjustment'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
