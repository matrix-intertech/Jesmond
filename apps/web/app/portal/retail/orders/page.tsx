"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

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
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
}

export default function SalesHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);

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

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order? This will restore inventory.")) return;
    
    setCancelling(true);
    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        // Refresh orders list
        await fetchOrders();
        setSelectedOrder(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to cancel order: ${err.message || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error cancelling order: ${e.message}`);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Sales History" description="View and manage retail orders and transactions." />
        <button onClick={fetchOrders} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Refresh
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
            ) : orders.length === 0 ? (
              <div className="p-12">
                <EmptyState 
                  title="No sales history found" 
                  description="Orders will appear here once transactions are completed."
                />
              </div>
            ) : (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Order Number</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Items</th>
                    <th className="px-6 py-4 font-medium">Total</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-brand-navy">{order.orderNumber}</td>
                      <td className="px-6 py-4 text-slate-600">{new Date(order.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {order.items?.reduce((acc, item) => acc + item.quantity, 0) || 0} items
                      </td>
                      <td className="px-6 py-4 font-bold text-brand-navy">${(order.total / 100).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : order.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          className="text-brand-orange hover:text-orange-700 font-medium text-sm"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <div>
                <h3 className="font-semibold text-lg text-brand-navy">Order Details: {selectedOrder.orderNumber}</h3>
                <p className="text-xs text-slate-500">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">Status</p>
                  <p className="font-medium text-brand-navy">{selectedOrder.status}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Branch ID</p>
                  <p className="font-medium text-brand-navy font-mono text-xs">{selectedOrder.branchId}</p>
                </div>
                {selectedOrder.customerId && (
                  <div>
                    <p className="text-slate-500 mb-1">Customer ID</p>
                    <p className="font-medium text-brand-navy font-mono text-xs">{selectedOrder.customerId}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-brand-navy mb-3 text-sm border-b pb-2">Line Items</h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded">
                      <div>
                        <p className="font-medium text-slate-700">Product ID: <span className="font-mono text-xs">{item.productId}</span></p>
                        <p className="text-xs text-slate-500">{item.quantity} x ${(item.unitPrice / 100).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${(item.lineTotal / 100).toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400">incl. tax ${(item.tax / 100).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2 text-sm text-right">
                <div className="flex justify-end gap-8 text-slate-600">
                  <span>Subtotal:</span>
                  <span className="w-20 font-medium">${(selectedOrder.subtotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8 text-slate-600">
                  <span>Tax:</span>
                  <span className="w-20 font-medium">${(selectedOrder.tax / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8 text-brand-navy font-bold text-lg pt-2 border-t mt-2">
                  <span>Total:</span>
                  <span className="w-20">${(selectedOrder.total / 100).toFixed(2)}</span>
                </div>
              </div>

              {selectedOrder.payments?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-brand-navy mb-3 text-sm border-b pb-2">Payments</h4>
                  <div className="space-y-2">
                    {selectedOrder.payments.map((payment, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm p-2 bg-blue-50/50 border border-blue-100 rounded">
                        <div>
                          <p className="font-medium text-blue-900">{payment.method} <span className="text-xs text-blue-600 ml-2">[{payment.status}]</span></p>
                          {payment.provider && <p className="text-xs text-slate-500">Provider: {payment.provider} {payment.transactionId && `(${payment.transactionId})`}</p>}
                        </div>
                        <p className="font-bold text-blue-900">${(payment.amount / 100).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-between items-center">
              {selectedOrder.status === 'PENDING' ? (
                <button 
                  onClick={() => handleCancelOrder(selectedOrder.id)}
                  disabled={cancelling}
                  className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Order'}
                </button>
              ) : (
                <div></div> // Empty div to keep the Close button on the right
              )}
              <button onClick={() => setSelectedOrder(null)} className="px-5 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
