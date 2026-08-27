"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";

export default function RetailOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    terminals: 0,
    customers: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      const token = getAccessToken();
      if (!token) return;
      
      try {
        // Fetch terminals to get count
        const termRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/terminals`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        // Fetch customers to get count
        const custRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/customers`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (termRes.ok && custRes.ok) {
          const terms = await termRes.json();
          const custs = await custRes.json();
          setMetrics({
            terminals: terms.length || 0,
            customers: custs.length || 0,
          });
        } else {
          await handleApiError(termRes, () => { clearAuth(); router.replace('/login'); });
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
          <div className="text-sm text-slate-400">Inventory API not available</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center">
          <h4 className="text-sm font-medium text-slate-500 mb-2">Today's Revenue</h4>
          <div className="text-sm text-slate-400">Orders API not available</div>
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
            <button onClick={() => router.push('/portal/retail/customers')} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 text-left transition-colors flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-brand-navy">New Customer</div>
                <div className="text-xs text-slate-500">Register profile</div>
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
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center items-center text-center h-full">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 text-slate-300">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-brand-navy mb-1">Recent Activity</h3>
          <p className="text-sm text-slate-500 mb-4 max-w-xs">Transaction and order history APIs are not currently available.</p>
        </div>
      </div>
    </div>
  );
}
