"use client";

import { useState, useEffect } from "react";
import { getAccessToken, getCurrentUser } from "@/utils/auth";
import { canUseBusinessCapability } from "@/utils/capabilities";
import { useRouter } from "next/navigation";
import Link from "next/link";

type FoodOrder = {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentType: string;
  total: number;
  createdAt: string;
  branch: { name: string };
  user: { firstName: string; lastName: string; phone?: string };
  items: any[];
};

export default function BusinessFoodOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || !canUseBusinessCapability(user.businessCategory as any, 'ORDERS')) {
      router.push('/portal');
      return;
    }
    
    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [statusFilter]);

  const fetchOrders = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/food/business/orders`);
      if (statusFilter) url.searchParams.append('status', statusFilter);
      url.searchParams.append('limit', '50'); // Ensure we fetch enough to group

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${getAccessToken()}` }
      });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED': return 'bg-blue-100 text-blue-800';
      case 'PREPARING': return 'bg-purple-100 text-purple-800';
      case 'READY': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderOrderGroup = (title: string, groupOrders: FoodOrder[]) => {
    if (groupOrders.length === 0) return null;
    return (
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-700 mb-4">{title} ({groupOrders.length})</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold text-slate-700">Order #</th>
                <th className="p-4 font-semibold text-slate-700">Date</th>
                <th className="p-4 font-semibold text-slate-700">Customer</th>
                <th className="p-4 font-semibold text-slate-700">Branch</th>
                <th className="p-4 font-semibold text-slate-700">Type</th>
                <th className="p-4 font-semibold text-slate-700">Total</th>
                <th className="p-4 font-semibold text-slate-700">Status</th>
                <th className="p-4 font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-900">{order.orderNumber}</td>
                  <td className="p-4 text-slate-600">{new Date(order.createdAt).toLocaleString()}</td>
                  <td className="p-4 text-slate-600">{order.user.firstName} {order.user.lastName}</td>
                  <td className="p-4 text-slate-600">{order.branch?.name}</td>
                  <td className="p-4 text-slate-600">{order.fulfillmentType}</td>
                  <td className="p-4 font-medium">${(order.total / 100).toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <Link href={`/portal/business/orders/${order.id}`} className="text-blue-600 font-semibold hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const newOrders = orders.filter(o => o.status === 'PENDING');
  const inProgressOrders = orders.filter(o => ['ACCEPTED', 'PREPARING', 'READY'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Food Orders</h1>
        <div className="flex gap-4 items-center">
          {loading && <span className="text-sm text-gray-500">Refreshing...</span>}
          <select 
            className="border rounded p-2" 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="PREPARING">Preparing</option>
            <option value="READY">Ready</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {orders.length === 0 && !loading ? (
        <p className="text-gray-500">No orders found.</p>
      ) : (
        <>
          {renderOrderGroup("NEW", newOrders)}
          {renderOrderGroup("IN PROGRESS", inProgressOrders)}
          {renderOrderGroup("COMPLETED", completedOrders)}
          {renderOrderGroup("CANCELLED", cancelledOrders)}
        </>
      )}
    </div>
  );
}
