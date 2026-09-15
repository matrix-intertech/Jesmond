"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";

interface Branch {
  id: string;
  name: string;
  deliveryEnabled: boolean;
  takeawayEnabled: boolean;
}

export default function RetailSettingsIndex() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchBranches = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/branches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setBranches(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const toggleBranchFeature = async (branchId: string, feature: 'deliveryEnabled' | 'takeawayEnabled', currentValue: boolean) => {
    setSaving(branchId);
    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/branches/${branchId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [feature]: !currentValue })
      });
      if (res.ok) {
        setBranches(branches.map(b => b.id === branchId ? { ...b, [feature]: !currentValue } : b));
      } else {
        alert('Failed to update branch setting');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4 max-w-2xl"><div className="h-8 bg-slate-200 rounded w-1/4"></div><div className="h-32 bg-slate-100 rounded-xl"></div></div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Delivery & Takeaway" description="Configure fulfillment options for your branches." />
      
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <ul className="divide-y divide-slate-100">
          {branches.map(branch => (
            <li key={branch.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-brand-navy">{branch.name}</h3>
                {saving === branch.id && <span className="text-xs text-slate-400">Saving...</span>}
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-medium text-sm text-slate-800">Takeaway Enabled</p>
                    <p className="text-xs text-slate-500">Allow customers to pick up orders from this branch.</p>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${branch.takeawayEnabled ? 'bg-brand-orange' : 'bg-slate-200'}`}>
                    <input type="checkbox" className="sr-only" checked={branch.takeawayEnabled} onChange={() => toggleBranchFeature(branch.id, 'takeawayEnabled', branch.takeawayEnabled)} disabled={saving === branch.id} />
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${branch.takeawayEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </label>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-medium text-sm text-slate-800">Delivery Enabled</p>
                    <p className="text-xs text-slate-500">Enable delivery fulfillment from this branch.</p>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${branch.deliveryEnabled ? 'bg-brand-orange' : 'bg-slate-200'}`}>
                    <input type="checkbox" className="sr-only" checked={branch.deliveryEnabled} onChange={() => toggleBranchFeature(branch.id, 'deliveryEnabled', branch.deliveryEnabled)} disabled={saving === branch.id} />
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${branch.deliveryEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </label>
              </div>
            </li>
          ))}
          
          {branches.length === 0 && (
            <li className="p-6 text-center text-slate-500 text-sm">No branches found.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
