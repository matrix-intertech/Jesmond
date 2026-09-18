"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import RetailGuard from "@/components/retail/RetailGuard";
import Link from "next/link";

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchOrder = async () => {
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
        setError("Failed to load order details.");
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
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
        await fetchOrder();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to update status: ${err.message || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error updating order: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <RetailGuard requirePermissions={['ORDERS_VIEW']}>
      <div className="p-8 space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/4 animate-pulse"></div>
        <div className="h-64 bg-slate-200 rounded animate-pulse"></div>
      </div>
    </RetailGuard>
  );

  if (error || !order) return (
    <RetailGuard requirePermissions={['ORDERS_VIEW']}>
      <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-100 flex items-center gap-3">
        <span>{error || "Order not found."}</span>
      </div>
    </RetailGuard>
  );

  const isDelivery = order.fulfillmentType === 'DELIVERY';
  const finalStatus = isDelivery ? 'DELIVERED' : 'TAKEN';

  return (
    <RetailGuard requirePermissions={['ORDERS_VIEW']}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/portal/retail/orders" className="text-slate-500 hover:text-brand-navy p-2 bg-white rounded-lg border border-slate-200 shadow-sm transition">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <PageHeader title={`Order ${order.orderNumber}`} description={`Placed on ${new Date(order.createdAt).toLocaleString()}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="font-semibold text-brand-navy mb-4">Order Items</h3>
                <div className="space-y-4">
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-700">{item.product?.name || `Product ${item.productId}`}</p>
                        <p className="text-xs text-slate-500 mt-1">{item.quantity} x ${(item.unitPrice / 100).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-brand-navy">${(item.lineTotal / 100).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-slate-50 space-y-2 text-sm text-right">
                <div className="flex justify-end gap-8 text-slate-600">
                  <span>Subtotal:</span>
                  <span className="w-24 font-medium">${(order.subtotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8 text-slate-600">
                  <span>Tax:</span>
                  <span className="w-24 font-medium">${(order.tax / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8 text-brand-navy font-bold text-lg pt-4 mt-2">
                  <span>Total:</span>
                  <span className="w-24">${(order.total / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-brand-navy mb-4">Order Status</h3>
              <div className="flex items-center gap-3 mb-6">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${order.fulfillmentType === 'DELIVERY' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                  {isDelivery ? 'Delivery' : 'Take Away'}
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="font-medium text-slate-700">{order.status}</span>
              </div>

              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${order.status !== 'PENDING' && order.status !== 'CANCELLED' ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <svg className="fill-white" xmlns="http://www.w3.org/2000/svg" width="9" height="7"><path fillRule="nonzero" d="M3.322 6.551.488 3.717 1.43 2.775l1.892 1.892 4.398-4.398.942.942z"/></svg>
                  </div>
                  <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-2 rounded border border-slate-200 bg-white shadow-sm flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-700">Pending</span>
                  </div>
                </div>
                
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${['ACCEPTED', 'PACKED', 'DELIVERED', 'TAKEN'].includes(order.status) ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    {['ACCEPTED', 'PACKED', 'DELIVERED', 'TAKEN'].includes(order.status) && <svg className="fill-white" xmlns="http://www.w3.org/2000/svg" width="9" height="7"><path fillRule="nonzero" d="M3.322 6.551.488 3.717 1.43 2.775l1.892 1.892 4.398-4.398.942.942z"/></svg>}
                  </div>
                  <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-2 rounded border border-slate-200 bg-white shadow-sm flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-700">Accepted</span>
                    {order.status === 'PENDING' && (
                      <button onClick={() => handleUpdateStatus('ACCEPTED')} disabled={updating} className="text-xs bg-brand-orange text-white px-2 py-1 rounded hover:bg-orange-600 disabled:opacity-50">Accept</button>
                    )}
                  </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${['PACKED', 'DELIVERED', 'TAKEN'].includes(order.status) ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    {['PACKED', 'DELIVERED', 'TAKEN'].includes(order.status) && <svg className="fill-white" xmlns="http://www.w3.org/2000/svg" width="9" height="7"><path fillRule="nonzero" d="M3.322 6.551.488 3.717 1.43 2.775l1.892 1.892 4.398-4.398.942.942z"/></svg>}
                  </div>
                  <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-2 rounded border border-slate-200 bg-white shadow-sm flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-700">Packed</span>
                    {order.status === 'ACCEPTED' && (
                      <button onClick={() => handleUpdateStatus('PACKED')} disabled={updating} className="text-xs bg-brand-orange text-white px-2 py-1 rounded hover:bg-orange-600 disabled:opacity-50">Mark Packed</button>
                    )}
                  </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${['DELIVERED', 'TAKEN'].includes(order.status) ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    {['DELIVERED', 'TAKEN'].includes(order.status) && <svg className="fill-white" xmlns="http://www.w3.org/2000/svg" width="9" height="7"><path fillRule="nonzero" d="M3.322 6.551.488 3.717 1.43 2.775l1.892 1.892 4.398-4.398.942.942z"/></svg>}
                  </div>
                  <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-2 rounded border border-slate-200 bg-white shadow-sm flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-700">{isDelivery ? 'Delivered' : 'Taken'}</span>
                    {order.status === 'PACKED' && (
                      <button onClick={() => handleUpdateStatus(finalStatus)} disabled={updating} className="text-xs bg-brand-orange text-white px-2 py-1 rounded hover:bg-orange-600 disabled:opacity-50">Mark {isDelivery ? 'Delivered' : 'Taken'}</button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-brand-navy mb-4">Customer Details</h3>
              {order.customer ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name</span>
                    <span className="font-medium text-brand-navy">{order.customer.firstName} {order.customer.lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email</span>
                    <span className="font-medium text-brand-navy">{order.customer.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone</span>
                    <span className="font-medium text-brand-navy">{order.customer.phone || 'N/A'}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Guest Customer</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </RetailGuard>
  );
}
