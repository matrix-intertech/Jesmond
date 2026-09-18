"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import RetailGuard from "@/components/retail/RetailGuard";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Truck, ShoppingBag, Store, Globe, CheckCircle2, AlertCircle } from "lucide-react";

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    const token = getAccessToken();
    if (!token) return router.replace('/login');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/orders/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setOrder(await res.json());
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || "Failed to load order details.");
      }
    } catch (e: any) {
      setError(e.message || "Network error while loading order.");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    setStatusFeedback(null);
    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/orders/${params.id}/status`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setOrder(updated);
        setStatusFeedback(`Order status updated to ${newStatus}`);
        setTimeout(() => setStatusFeedback(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to update status: ${err.message || 'Invalid status transition'}`);
      }
    } catch (e: any) {
      alert(`Error updating order: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <RetailGuard requirePermissions={['ORDERS_VIEW']}>
      <div className="p-8 space-y-6">
        <div className="h-8 bg-slate-200 rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-200 rounded-xl animate-pulse"></div>
          <div className="h-96 bg-slate-200 rounded-xl animate-pulse"></div>
        </div>
      </div>
    </RetailGuard>
  );

  if (error || !order) return (
    <RetailGuard requirePermissions={['ORDERS_VIEW']}>
      <div className="p-8 max-w-xl mx-auto space-y-4 text-center">
        <div className="bg-rose-50 text-rose-700 p-6 rounded-2xl border border-rose-100 flex flex-col items-center gap-3">
          <AlertCircle size={36} className="text-rose-500" />
          <h3 className="font-bold text-lg">{error || "Order not found"}</h3>
          <p className="text-sm text-rose-600">The requested order could not be retrieved or you do not have permission to view it.</p>
          <button
            onClick={fetchOrder}
            className="mt-2 px-4 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition flex items-center gap-2 text-sm shadow-sm"
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    </RetailGuard>
  );

  const isDelivery = order.fulfillmentType === 'DELIVERY';
  const isTakeaway = order.fulfillmentType === 'TAKEAWAY';
  const finalStatus = isDelivery ? 'DELIVERED' : 'TAKEN';
  const payment = order.payments && order.payments.length > 0 ? order.payments[0] : null;

  return (
    <RetailGuard requirePermissions={['ORDERS_VIEW']}>
      <div className="space-y-6">
        {/* Top Header & Meta */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/portal/retail/orders" className="text-slate-500 hover:text-brand-navy p-2 bg-white rounded-xl border border-slate-200 shadow-sm transition">
              <ArrowLeft size={20} />
            </Link>
            <PageHeader title={`Order ${order.orderNumber}`} description={`Placed on ${new Date(order.createdAt).toLocaleString()}`} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Fulfillment Tag */}
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              isDelivery ? 'bg-purple-100 text-purple-800 border border-purple-200' :
              isTakeaway ? 'bg-blue-100 text-blue-800 border border-blue-200' :
              'bg-slate-100 text-slate-800 border border-slate-200'
            }`}>
              {isDelivery ? <Truck size={14} /> : isTakeaway ? <ShoppingBag size={14} /> : <Store size={14} />}
              {order.fulfillmentType}
            </span>

            {/* Source Tag */}
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
              {order.source === 'ONLINE' ? <Globe size={14} /> : <Store size={14} />}
              {order.source || 'IN_STORE'}
            </span>

            {/* Status Tag */}
            <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider ${
              order.status === 'COMPLETED' || order.status === 'DELIVERED' || order.status === 'TAKEN' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
              order.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
              'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              {order.status}
            </span>
          </div>
        </div>

        {statusFeedback && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in duration-300">
            <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
            <span className="font-medium text-sm">{statusFeedback}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Left Column: Items & Financial Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="font-bold text-brand-navy text-lg mb-4">Order Items</h3>
                <div className="divide-y divide-slate-100">
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="py-4 first:pt-0 last:pb-0 flex justify-between items-center text-sm">
                      <div>
                        <p className="font-bold text-slate-800">{item.product?.name || `Product ${item.productId}`}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          {item.product?.sku && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">SKU: {item.product.sku}</span>}
                          <span>Qty: {item.quantity}</span>
                          <span>Unit: ${(item.unitPrice / 100).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-brand-navy">${(item.lineTotal / 100).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="p-6 bg-slate-50/70 space-y-2.5 text-sm">
                <h4 className="font-semibold text-slate-700 mb-3 uppercase tracking-wider text-xs">Financial Summary</h4>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">${(order.subtotal / 100).toFixed(2)}</span>
                </div>
                {order.deliveryFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Fee</span>
                    <span className="font-semibold text-slate-800">${(order.deliveryFee / 100).toFixed(2)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-semibold">-${(order.discount / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span className="font-semibold text-slate-800">${(order.tax / 100).toFixed(2)}</span>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-base">
                  <span className="font-bold text-brand-navy">Grand Total</span>
                  <span className="font-black text-xl text-brand-orange">${(order.total / 100).toFixed(2)}</span>
                </div>

                {/* Payment Breakdown */}
                <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs text-slate-500">
                  <span>Payment Method: <strong className="text-slate-800 font-semibold">{payment?.method || 'CASH'}</strong></span>
                  <span>Status: <strong className={`font-semibold ${payment?.status === 'PAID' || order.status === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-600'}`}>{payment?.status || (order.status === 'COMPLETED' ? 'PAID' : 'PENDING')}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Status Timeline & Customer Info */}
          <div className="space-y-6">
            {/* Operational Workflow Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
              <h3 className="font-bold text-brand-navy text-lg mb-4">Order Operations</h3>

              {/* Status Timeline */}
              <div className="space-y-4 mb-6">
                {/* Step 1: PENDING */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    order.status !== 'PENDING' && order.status !== 'CANCELLED' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">PENDING</p>
                    <p className="text-[11px] text-slate-500">Order received</p>
                  </div>
                </div>

                {/* Step 2: ACCEPTED */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    ['ACCEPTED', 'PACKED', 'DELIVERED', 'TAKEN'].includes(order.status) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">ACCEPTED</p>
                    <p className="text-[11px] text-slate-500">Store accepted order</p>
                  </div>
                  {order.status === 'PENDING' && (
                    <button
                      onClick={() => handleUpdateStatus('ACCEPTED')}
                      disabled={updating}
                      className="px-3 py-1.5 bg-brand-orange text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
                    >
                      Accept
                    </button>
                  )}
                </div>

                {/* Step 3: PACKED */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    ['PACKED', 'DELIVERED', 'TAKEN'].includes(order.status) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">PACKED</p>
                    <p className="text-[11px] text-slate-500">Order packed and ready</p>
                  </div>
                  {order.status === 'ACCEPTED' && (
                    <button
                      onClick={() => handleUpdateStatus('PACKED')}
                      disabled={updating}
                      className="px-3 py-1.5 bg-brand-orange text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
                    >
                      Mark Packed
                    </button>
                  )}
                </div>

                {/* Step 4: DELIVERED / TAKEN */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    ['DELIVERED', 'TAKEN'].includes(order.status) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    4
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">{isDelivery ? 'DELIVERED' : 'TAKEN'}</p>
                    <p className="text-[11px] text-slate-500">{isDelivery ? 'Handed to customer' : 'Picked up by customer'}</p>
                  </div>
                  {order.status === 'PACKED' && (
                    <button
                      onClick={() => handleUpdateStatus(finalStatus)}
                      disabled={updating}
                      className="px-3 py-1.5 bg-brand-orange text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
                    >
                      Mark {isDelivery ? 'Delivered' : 'Taken'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Information Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
              <h3 className="font-bold text-brand-navy text-lg mb-4">Customer Details</h3>
              {order.customer ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Name</span>
                    <span className="font-bold text-brand-navy">{order.customer.firstName} {order.customer.lastName || ''}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Email</span>
                    <span className="font-medium text-slate-800">{order.customer.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Phone</span>
                    <span className="font-medium text-slate-800">{order.customer.phone || 'N/A'}</span>
                  </div>
                  {isDelivery && (
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Delivery Address</span>
                      <span className="font-medium text-slate-800 text-right max-w-[180px]">{order.customer.address || 'Address provided at checkout'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                  Guest Walk-in Customer
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RetailGuard>
  );
}
