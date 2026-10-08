"use client";

import { CheckCircle, ShoppingBag, ArrowRight, Loader2, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, use } from "react";
import { getAccessToken } from "@/utils/auth";
import { getApiUrl } from "@/utils/api";

export default function OrderSuccessPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(`${getApiUrl()}/api/v1/retail/marketplace/orders/${orderId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
        } else {
          setError("Failed to load order details.");
        }
      } catch (err) {
        setError("Network error loading order.");
      } finally {
        setLoading(false);
      }
    };
    
    if (orderId) fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 px-6">
        <Loader2 className="animate-spin text-accent" size={48} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 px-6">
        <div className="max-w-md w-full bg-surface rounded-3xl p-10 border border-border-strong text-center">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
          <h1 className="text-2xl font-bold mb-4">Error Loading Order</h1>
          <p className="text-text-secondary mb-6">{error}</p>
          <Link href="/businesses" className="text-accent hover:underline font-bold">Return to Store</Link>
        </div>
      </div>
    );
  }

  const isPending = order.status === 'PENDING' || (order.payments && order.payments.some((p: any) => p.status === 'PENDING'));

  return (
    <div className="flex-1 flex items-center justify-center py-20 px-6">
      <div className="max-w-md w-full bg-surface rounded-3xl p-10 border border-border-strong shadow-xl shadow-slate-200/50 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-accent"></div>
        
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ${isPending ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500'}`}>
          {isPending ? <Clock size={48} strokeWidth={2} /> : <CheckCircle size={48} strokeWidth={2} />}
        </div>
        
        <h1 className="text-3xl font-extrabold text-primary mb-2 tracking-tight">
          {isPending ? 'Order Placed — Payment Pending' : 'Order Confirmed!'}
        </h1>
        <p className="text-text-secondary mb-8">
          {isPending 
            ? "We've received your order and are waiting for payment confirmation."
            : "Thank you for your purchase. We've received your order and are processing it now."}
        </p>

        <div className="bg-surface-lavender rounded-xl p-4 border border-border-subtle mb-6 flex flex-col gap-1 text-left">
          <div className="flex justify-between items-center border-b border-border-strong pb-2 mb-2">
            <span className="text-sm font-medium text-text-muted uppercase tracking-wider">Order Ref</span>
            <span className="text-sm font-bold text-primary font-mono">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between items-center border-b border-border-strong pb-2 mb-2">
            <span className="text-sm font-medium text-text-muted uppercase tracking-wider">Fulfillment</span>
            <span className="text-sm font-bold text-primary">{order.fulfillmentType}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-text-muted uppercase tracking-wider">Total</span>
            <span className="text-sm font-bold text-primary">${(order.total / 100).toFixed(2)}</span>
          </div>
        </div>

        {order.fulfillmentType === 'DELIVERY' && order.deliveryAddress && (
          <div className="text-left bg-surface rounded-xl p-4 border border-border-strong mb-8">
            <h3 className="font-bold text-primary text-sm mb-2">Delivery Address</h3>
            <p className="text-sm text-text-secondary">{order.deliveryAddress.name}</p>
            <p className="text-sm text-text-secondary">{order.deliveryAddress.addressLine}</p>
            <p className="text-sm text-text-secondary">{order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.postalCode}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-8">
          <Link
            href="/businesses"
            className="w-full py-3.5 bg-accent hover:bg-accent text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-orange-500/20"
          >
            <ShoppingBag size={18} /> Continue Shopping
          </Link>
          <Link
            href="/student"
            className="w-full py-3.5 bg-surface border border-border-strong hover:border-border-strong hover:bg-surface-lavender text-primary font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            Go to Dashboard <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
