"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import RetailGuard from "@/components/retail/RetailGuard";

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

function SalesHistoryContent() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [activeTab, setActiveTab] = useState<'IN_STORE' | 'ONLINE'>('IN_STORE');

  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      } else {
        if (res.status === 401) {
          clearAuth();
          router.replace('/login');
        } else {
          setError("Failed to fetch sales history.");
        }
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const displayedOrders = orders.filter(order => {
    if (activeTab === 'IN_STORE') {
      return order.source === 'IN_STORE';
    } else {
      return order.source === 'ONLINE' || order.source === 'APP';
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Sales History" description="View completed sales transactions." />
        <button onClick={fetchOrders} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Refresh
        </button>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('IN_STORE')}
          className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'IN_STORE' ? 'text-brand-navy' : 'text-slate-500 hover:text-slate-700'}`}
        >
          In-Store Sales
          {activeTab === 'IN_STORE' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-orange" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('ONLINE')}
          className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'ONLINE' ? 'text-brand-navy' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Online Orders
          {activeTab === 'ONLINE' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-orange" />
          )}
        </button>
      </div>

      {error ? (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-100 flex items-center gap-3">
          <span>{error}</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                  title="No sales history found" 
                  description="Transactions will appear here."
                />
              </div>
            ) : (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Order ID</th>
                    <th className="px-6 py-4 font-medium">Date & Time</th>
                    {activeTab === 'ONLINE' && (
                      <th className="px-6 py-4 font-medium">Order Type</th>
                    )}
                    <th className="px-6 py-4 font-medium">Items</th>
                    <th className="px-6 py-4 font-medium">Amount</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-brand-navy">{order.orderNumber}</td>
                      <td className="px-6 py-4 text-slate-600">{new Date(order.createdAt).toLocaleString()}</td>
                      {activeTab === 'ONLINE' && (
                        <td className="px-6 py-4 text-slate-600">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${order.fulfillmentType === 'DELIVERY' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {order.fulfillmentType === 'DELIVERY' ? 'Delivery' : order.fulfillmentType === 'TAKEAWAY' ? 'Take Away' : 'In-Store'}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 text-slate-600">
                        {order.items?.reduce((acc, item) => acc + item.quantity, 0) || 0} items
                      </td>
                      <td className="px-6 py-4 font-bold text-brand-navy">${(order.total / 100).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${['COMPLETED', 'DELIVERED', 'TAKEN'].includes(order.status) ? 'bg-emerald-100 text-emerald-800' : order.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesHistoryPage() {
  return (
    <RetailGuard requirePermissions={['ORDERS_VIEW']}>
      <SalesHistoryContent />
    </RetailGuard>
  );
}
