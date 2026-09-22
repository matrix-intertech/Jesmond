"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import RetailGuard from "@/components/retail/RetailGuard";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  lineTotal: number;
}

interface Payment {
  id: string;
  method: string;
  status: string;
  amount: number;
  provider?: string;
  transactionId?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  customerId?: string | null;
  status: string;
  source: string;
  fulfillmentType: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
}

function OrdersContent() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("ALL_ACTIVE");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status: statusFilter,
      });

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        if (result && Array.isArray(result.data)) {
          setOrders(result.data);
          if (result.meta) {
            setTotal(result.meta.total || result.data.length);
            setTotalPages(result.meta.totalPages || 1);
          }
        } else if (Array.isArray(result)) {
          setOrders(result);
          setTotal(result.length);
          setTotalPages(1);
        }
      } else {
        if (res.status === 401) {
          clearAuth();
          router.replace('/login');
        } else {
          setError("Failed to fetch orders.");
        }
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, router]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleTypeFilterChange = (val: string) => {
    setTypeFilter(val);
    setPage(1);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        await fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to update status: ${err.message || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error updating order: ${e.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const getNextAction = (order: Order) => {
    if (order.status === 'PENDING') return { label: 'Accept', status: 'ACCEPTED' };
    if (order.status === 'ACCEPTED') return { label: 'Mark Packed', status: 'PACKED' };
    if (order.status === 'PACKED') {
      if (order.fulfillmentType === 'DELIVERY') return { label: 'Mark Delivered', status: 'DELIVERED' };
      if (order.fulfillmentType === 'TAKEAWAY') return { label: 'Mark Taken', status: 'TAKEN' };
    }
    return null;
  };

  const displayedOrders = orders.filter(order => {
    if (order.source === 'IN_STORE') return false;
    if (typeFilter !== 'ALL' && order.fulfillmentType !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Orders" description="Manage active online and operational orders." />
        <button onClick={fetchOrders} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto">
          Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select 
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="w-full sm:w-48 text-sm rounded-lg border-slate-200 shadow-sm focus:border-brand-orange focus:ring-brand-orange"
          >
            <option value="ALL_ACTIVE">All Active</option>
            <option value="ALL">All Orders</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="PACKED">Packed</option>
            <option value="DELIVERED">Delivered</option>
            <option value="TAKEN">Taken</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Order Type</label>
          <select 
            value={typeFilter}
            onChange={(e) => handleTypeFilterChange(e.target.value)}
            className="w-full sm:w-48 text-sm rounded-lg border-slate-200 shadow-sm focus:border-brand-orange focus:ring-brand-orange"
          >
            <option value="ALL">All Types</option>
            <option value="DELIVERY">Delivery</option>
            <option value="TAKEAWAY">Take Away</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-100 flex items-center gap-3">
          <span>{error}</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
              <div className="p-8 space-y-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : displayedOrders.length === 0 ? (
              <div className="p-12">
                <EmptyState 
                  title="No orders found" 
                  description="Adjust filters or wait for new orders to arrive."
                />
              </div>
            ) : (
              <>
                <div className="space-y-3 p-3 md:hidden">
                  {displayedOrders.map(order => {
                    const nextAction = getNextAction(order);
                    return (
                      <div key={`mobile-${order.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Link href={`/portal/retail/orders/${order.id}`} className="font-semibold text-brand-orange hover:underline">
                              {order.orderNumber}
                            </Link>
                            <p className="mt-1 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
                          </div>
                          <span className={`shrink-0 px-2 py-1 text-xs font-medium rounded-full ${
                            order.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                            order.status === 'ACCEPTED' ? 'bg-sky-100 text-sky-800' :
                            order.status === 'PACKED' ? 'bg-indigo-100 text-indigo-800' :
                            order.status === 'DELIVERED' || order.status === 'TAKEN' ? 'bg-emerald-100 text-emerald-800' :
                            order.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase()}
                          </span>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div><dt className="text-xs uppercase text-slate-400">Type</dt><dd className="font-medium text-slate-700">{order.fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Take Away'}</dd></div>
                          <div><dt className="text-xs uppercase text-slate-400">Items</dt><dd className="font-medium text-slate-700">{order.items?.reduce((acc, item) => acc + item.quantity, 0) || 0}</dd></div>
                          <div><dt className="text-xs uppercase text-slate-400">Amount</dt><dd className="font-bold text-brand-navy">${(order.total / 100).toFixed(2)}</dd></div>
                        </dl>
                        <div className="mt-4 flex flex-col gap-2">
                          {nextAction && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, nextAction.status)}
                              disabled={updatingId === order.id}
                              className="min-h-11 rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                            >
                              {updatingId === order.id ? 'Updating...' : nextAction.label}
                            </button>
                          )}
                          <Link href={`/portal/retail/orders/${order.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-700">
                            Details
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <table className="hidden w-full whitespace-nowrap text-left text-sm md:table">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Order ID</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Items</th>
                    <th className="px-6 py-4 font-medium">Amount</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedOrders.map(order => {
                    const nextAction = getNextAction(order);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-brand-navy">
                          <Link href={`/portal/retail/orders/${order.id}`} className="hover:underline text-brand-orange">
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{new Date(order.createdAt).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${order.fulfillmentType === 'DELIVERY' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {order.fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Take Away'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {order.items?.reduce((acc, item) => acc + item.quantity, 0) || 0} items
                        </td>
                        <td className="px-6 py-4 font-bold text-brand-navy">${(order.total / 100).toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            order.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                            order.status === 'ACCEPTED' ? 'bg-sky-100 text-sky-800' :
                            order.status === 'PACKED' ? 'bg-indigo-100 text-indigo-800' :
                            order.status === 'DELIVERED' || order.status === 'TAKEN' ? 'bg-emerald-100 text-emerald-800' :
                            order.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-3 items-center">
                          {nextAction && (
                            <button 
                              onClick={() => handleUpdateStatus(order.id, nextAction.status)}
                              disabled={updatingId === order.id}
                              className="px-3 py-1.5 bg-brand-orange text-white hover:bg-orange-600 rounded text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {updatingId === order.id ? '...' : nextAction.label}
                            </button>
                          )}
                          <Link 
                            href={`/portal/retail/orders/${order.id}`}
                            className="text-slate-500 hover:text-brand-navy font-medium text-xs"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </>
            )}
          </div>

          {/* Pagination Controls Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <div>
                Showing Page <span className="font-bold text-slate-800">{page}</span> of <span className="font-bold text-slate-800">{totalPages}</span> ({total} total orders)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1 transition"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1 transition"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RetailGuard requirePermissions={['ORDERS_VIEW']}>
      <OrdersContent />
    </RetailGuard>
  );
}
