"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isAuthenticated, getAccessToken } from "@/utils/auth";
import { CheckCircle, ArrowLeft, Loader2, AlertTriangle, Package, Clock } from "lucide-react";
import Link from "next/link";

interface FoodOrderItem {
  id: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface FoodOrder {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  total: number;
  createdAt: string;
  fulfillmentType: string;
  deliveryAddress: any;
  statusHistory: any[];
  items: FoodOrderItem[];
  branch: { name: string };
}

export default function FoodOrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<FoodOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    try {
      const token = getAccessToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/v1/food/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to load order');
      }

      const data = await res.json();
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Error loading order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    if (orderId) {
      fetchOrder();
    }
  }, [orderId, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-accent" size={48} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex-1 max-w-[600px] mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center text-red-500">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2">Order Not Found</h1>
        <p className="text-text-secondary mb-8">{error || 'This order could not be loaded.'}</p>
        <Link href="/businesses" className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-bold hover:shadow-lg transition-all">
          Browse Businesses
        </Link>
      </div>
    );
  }

  const statusColor = order.status === 'CANCELLED'
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-green-50 text-green-700 border-green-200';

  const statusIcon = order.status === 'CANCELLED'
    ? <AlertTriangle size={20} />
    : <Clock size={20} />;

  return (
    <div className="flex-1 max-w-[800px] w-full mx-auto px-6 sm:px-12 py-12">
      <div className="flex justify-between items-center mb-8">
        <Link href="/businesses" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent transition-colors font-medium">
          <ArrowLeft size={18} /> Browse Businesses
        </Link>
        <button 
          onClick={() => { setLoading(true); fetchOrder(); }}
          className="text-sm px-3 py-1 bg-surface-muted border border-border-strong rounded hover:bg-surface transition-colors"
        >
          Refresh Status
        </button>
      </div>

      {/* Success banner */}
      {order.status === 'PENDING' && (
        <div className="bg-green-50 border border-green-200 rounded-3xl p-8 mb-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center text-green-600">
            <CheckCircle size={36} />
          </div>
          <h1 className="text-3xl font-extrabold text-primary mb-2">Order Placed!</h1>
          <p className="text-text-secondary font-medium">
            Your order <span className="font-bold text-primary">{order.orderNumber}</span> has been received.
          </p>
        </div>
      )}

      {/* Order Details */}
      <div className="bg-surface rounded-3xl border border-border-strong/60 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-border-strong/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Package size={22} className="text-accent" />
                <h2 className="text-xl font-bold text-primary">Order Details</h2>
              </div>
              <p className="text-text-secondary text-sm">
                {order.branch?.name} • {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-bold text-sm ${statusColor}`}>
              {statusIcon}
              {order.status}
            </div>
          </div>
        </div>

        {/* Fulfillment & Cash Info */}
        <div className="p-6 sm:p-8 border-b border-border-strong/40 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50">
          <div>
            <h4 className="font-bold text-primary uppercase text-sm mb-2">Fulfillment</h4>
            <p className="font-medium text-slate-700">{order.fulfillmentType}</p>
            {order.fulfillmentType === 'DELIVERY' && order.deliveryAddress && (
              <div className="mt-2 text-sm text-slate-600">
                <p>{order.deliveryAddress.name} ({order.deliveryAddress.phone})</p>
                <p>{order.deliveryAddress.addressLine1}</p>
                {order.deliveryAddress.addressLine2 && <p>{order.deliveryAddress.addressLine2}</p>}
                <p>{order.deliveryAddress.city}, {order.deliveryAddress.postalCode}</p>
              </div>
            )}
          </div>
          <div>
            <h4 className="font-bold text-primary uppercase text-sm mb-2">Payment Method</h4>
            <p className="font-bold text-green-700 bg-green-100 inline-block px-3 py-1 rounded">
              {order.fulfillmentType === 'DELIVERY' ? 'CASH ON DELIVERY' : 'CASH AT TAKEAWAY'}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Please have exact change ready.
            </p>
          </div>
        </div>

        {/* Items */}
        <div className="divide-y divide-border-strong/30">
          {order.items.map((item) => (
            <div key={item.id} className="p-6 sm:px-8 flex items-center gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-primary">{item.itemName}</h4>
                <p className="text-sm text-text-secondary">
                  Qty: {item.quantity} × ${(item.unitPrice / 100).toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <span className="font-extrabold text-primary">
                  ${(item.lineTotal / 100).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="p-6 sm:p-8 bg-surface-muted border-t border-border-strong/40">
          <div className="space-y-3 max-w-xs ml-auto">
            <div className="flex justify-between text-text-secondary font-medium">
              <span>Subtotal</span>
              <span className="text-primary">${(order.subtotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-border-strong/40">
              <span className="text-lg font-bold text-primary">Total to Pay (CASH)</span>
              <span className="text-lg font-extrabold text-accent">
                ${(order.total / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {order.statusHistory && order.statusHistory.length > 0 && (
        <div className="mt-8 bg-surface rounded-3xl p-6 sm:p-8 border border-border-strong/60 shadow-sm">
          <h3 className="font-bold text-lg mb-6">Order Timeline</h3>
          <div className="space-y-6">
            {[...order.statusHistory].reverse().map((history: any, index: number) => (
              <div key={history.id} className="relative pl-8 border-l-2 border-accent/20 last:border-transparent pb-2">
                <div className="absolute w-4 h-4 bg-accent rounded-full -left-[9px] top-0 border-4 border-surface"></div>
                <p className="font-bold text-primary">{history.toStatus}</p>
                <p className="text-sm text-text-secondary">{new Date(history.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
