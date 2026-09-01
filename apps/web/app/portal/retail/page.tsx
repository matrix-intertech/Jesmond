"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
}

export default function RetailOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    terminals: 0,
    customers: 0,
    revenue: 0,
    lowStock: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      const token = getAccessToken();
      if (!token) return;
      
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        // Fetch parallel
        const [termRes, custRes, orderRes, branchRes] = await Promise.all([
          fetch(`${apiUrl}/api/v1/retail/terminals`, { headers }),
          fetch(`${apiUrl}/api/v1/retail/customers`, { headers }),
          fetch(`${apiUrl}/api/v1/retail/orders`, { headers }),
          fetch(`${apiUrl}/api/v1/retail/branches`, { headers }),
        ]);

        let terminalsCount = 0;
        let customersCount = 0;
        let todayRevenue = 0;
        let lowStockCount = 0;
        let latestOrders: Order[] = [];

        if (termRes.ok) terminalsCount = (await termRes.json()).length || 0;
        if (custRes.ok) customersCount = (await custRes.json()).length || 0;

        if (orderRes.ok) {
          const orders = await orderRes.json();
          latestOrders = orders.slice(0, 3);
          
          const today = new Date().toDateString();
          todayRevenue = orders
            .filter((o: any) => o.status === 'COMPLETED' && new Date(o.createdAt).toDateString() === today)
            .reduce((sum: number, o: any) => sum + o.total, 0);
        }

        if (branchRes.ok) {
          const branches = await branchRes.json();
          const invPromises = branches.map((b: any) => fetch(`${apiUrl}/api/v1/retail/inventory/${b.id}`, { headers }));
          const invResponses = await Promise.all(invPromises);
          
          for (const res of invResponses) {
            if (res.ok) {
              const inv = await res.json();
              lowStockCount += inv.filter((item: any) => item.quantity <= 5).length;
            }
          }
        }

        setMetrics({
          terminals: terminalsCount,
          customers: customersCount,
          revenue: todayRevenue,
          lowStock: lowStockCount,
        });
        setRecentOrders(latestOrders);

        if (termRes.status === 401 || custRes.status === 401 || orderRes.status === 401) {
          clearAuth();
          router.replace('/login');
        }
      } catch (e) {
        console.error("Failed to fetch retail metrics", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetrics();
  }, [router]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Retail Overview" 
        description="Monitor your retail operations, customers, and points of sale." 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Terminals"
          value={loading ? "-" : metrics.terminals.toString()}
          loading={loading}
        />
        <StatCard
          label="Total Customers"
          value={loading ? "-" : metrics.customers.toString()}
          loading={loading}
        />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center">
          <h4 className="text-sm font-medium text-slate-500 mb-2">Inventory Alerts</h4>
          <div className={`text-2xl font-bold ${metrics.lowStock > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {loading ? '-' : `${metrics.lowStock} items low/out`}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center">
          <h4 className="text-sm font-medium text-slate-500 mb-2">Today's Revenue</h4>
          <div className="text-2xl font-bold text-brand-navy">
            {loading ? '-' : `$${(metrics.revenue / 100).toFixed(2)}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-brand-navy mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => router.push('/portal/retail/pos')} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 text-left transition-colors flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-brand-navy">Launch POS</div>
                <div className="text-xs text-slate-500">Open register</div>
              </div>
            </button>
            <button onClick={() => router.push('/portal/retail/catalog')} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 text-left transition-colors flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-brand-navy">Add Product</div>
                <div className="text-xs text-slate-500">Update catalog</div>
              </div>
            </button>
            <button onClick={() => router.push('/portal/retail/orders')} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 text-left transition-colors flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-brand-navy">Sales History</div>
                <div className="text-xs text-slate-500">View recent orders</div>
              </div>
            </button>
            <button onClick={() => router.push('/portal/retail/terminals')} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 text-left transition-colors flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                  <line x1="9" y1="1" x2="9" y2="4" />
                  <line x1="15" y1="1" x2="15" y2="4" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-brand-navy">Manage POS</div>
                <div className="text-xs text-slate-500">Terminal settings</div>
              </div>
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
          <h3 className="text-lg font-semibold text-brand-navy mb-4">Recent Activity</h3>
          {loading ? (
            <div className="animate-pulse flex flex-col gap-4 mt-4">
              <div className="h-4 bg-slate-200 rounded w-full"></div>
              <div className="h-4 bg-slate-200 rounded w-full"></div>
            </div>
          ) : recentOrders.length > 0 ? (
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="space-y-3">
                {recentOrders.map(order => (
                  <div key={order.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-slate-50">
                    <div>
                      <div className="font-medium text-sm text-brand-navy">{order.orderNumber}</div>
                      <div className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-brand-navy">${(order.total / 100).toFixed(2)}</div>
                      <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block mt-1 ${order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : order.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {order.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => router.push('/portal/retail/orders')}
                className="w-full mt-4 py-2 text-sm text-brand-orange hover:text-brand-orange/80 font-medium text-center"
              >
                View All Orders &rarr;
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-6">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 text-slate-300">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 mb-2">No recent orders found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
