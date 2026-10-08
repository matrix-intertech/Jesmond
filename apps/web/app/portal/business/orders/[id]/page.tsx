"use client";

import { useState, useEffect } from "react";
import { getAccessToken, getCurrentUser } from "@/utils/auth";
import { canUseBusinessCapability } from "@/utils/capabilities";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function BusinessFoodOrderDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || !canUseBusinessCapability(user.businessCategory as any, 'ORDERS')) {
      router.push('/portal');
      return;
    }
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/food/business/orders/${id}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` }
      });
      if (res.ok) {
        const json = await res.json();
        setOrder(json);
      } else {
        router.push('/portal/business/orders');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/food/business/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}` 
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const json = await res.json();
        setOrder(json);
      } else {
        alert("Failed to update status.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!order) return null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/portal/business/orders" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Orders</Link>
      
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Order #{order.orderNumber}</h1>
          <p className="text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold block">${(order.total / 100).toFixed(2)}</span>
          <span className="text-sm font-semibold uppercase tracking-wider text-slate-500 block">
            {order.fulfillmentType === 'DELIVERY' ? 'CASH ON DELIVERY' : 'CASH AT TAKEAWAY'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="font-bold mb-4 text-lg">Customer</h3>
          <p className="font-medium text-slate-900">{order.user.firstName} {order.user.lastName}</p>
          <p className="text-slate-600">{order.user.phone}</p>
          
          {order.fulfillmentType === 'DELIVERY' && order.deliveryAddress && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="font-semibold text-sm text-slate-500 mb-2 uppercase">Delivery Address</h4>
              <p className="text-slate-800">{order.deliveryAddress.name} ({order.deliveryAddress.phone})</p>
              <p className="text-slate-600">{order.deliveryAddress.addressLine1}</p>
              {order.deliveryAddress.addressLine2 && <p className="text-slate-600">{order.deliveryAddress.addressLine2}</p>}
              <p className="text-slate-600">{order.deliveryAddress.city}, {order.deliveryAddress.postalCode}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="font-bold mb-4 text-lg">Order Status: {order.status}</h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {order.status === 'PENDING' && (
              <>
                <button disabled={updating} onClick={() => updateStatus('ACCEPTED')} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700">Accept</button>
                <button disabled={updating} onClick={() => updateStatus('CANCELLED')} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-semibold hover:bg-red-200">Cancel</button>
              </>
            )}
            {order.status === 'ACCEPTED' && (
              <>
                <button disabled={updating} onClick={() => updateStatus('PREPARING')} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700">Start Preparing</button>
                <button disabled={updating} onClick={() => updateStatus('CANCELLED')} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-semibold hover:bg-red-200">Cancel</button>
              </>
            )}
            {order.status === 'PREPARING' && (
              <>
                <button disabled={updating} onClick={() => updateStatus('READY')} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-600">Mark Ready</button>
                <button disabled={updating} onClick={() => updateStatus('CANCELLED')} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-semibold hover:bg-red-200">Cancel</button>
              </>
            )}
            {order.status === 'READY' && (
              <button disabled={updating} onClick={() => updateStatus('COMPLETED')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700">Mark Completed</button>
            )}
            {order.status === 'COMPLETED' && <span className="text-green-700 font-bold">Order Completed</span>}
            {order.status === 'CANCELLED' && <span className="text-red-700 font-bold">Order Cancelled</span>}
          </div>

          {order.statusHistory && order.statusHistory.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <h4 className="font-semibold text-sm text-slate-500 mb-4 uppercase">Status Timeline</h4>
              <div className="space-y-4">
                {[...order.statusHistory].reverse().map((history: any, index: number) => (
                  <div key={history.id} className="relative pl-6 border-l-2 border-slate-200 last:border-transparent">
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 border-2 border-white"></div>
                    <p className="font-semibold text-slate-800">{history.toStatus}</p>
                    <p className="text-xs text-slate-500">{new Date(history.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="font-bold mb-4 text-lg">Items</h3>
        <ul className="divide-y divide-slate-100">
          {order.items.map((item: any) => (
            <li key={item.id} className="py-4 flex justify-between">
              <div>
                <p className="font-semibold text-slate-800">{item.itemName}</p>
                <p className="text-slate-500 text-sm">Qty: {item.quantity} × ${(item.unitPrice / 100).toFixed(2)}</p>
              </div>
              <p className="font-bold text-slate-900">${(item.lineTotal / 100).toFixed(2)}</p>
            </li>
          ))}
        </ul>
        <div className="pt-4 mt-4 border-t border-slate-200 flex justify-between font-bold text-lg">
          <span>Subtotal</span>
          <span>${(order.subtotal / 100).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
