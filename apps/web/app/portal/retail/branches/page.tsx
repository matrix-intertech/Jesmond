"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";

interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export default function BranchesPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    isActive: true
  });
  
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchBranches = async () => {
    setLoading(true);
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        const json = await res.json();
        setBranches(json);
      } else {
        setError('Failed to load branches');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const openCreateModal = () => {
    setEditingBranch(null);
    setFormData({ name: '', address: '', phone: '', isActive: true });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      isActive: branch.isActive
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    const token = getAccessToken();
    try {
      const isEdit = !!editingBranch;
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/branches${isEdit ? `/${editingBranch.id}` : ''}`;
      
      const payload: any = {
        name: formData.name,
        address: formData.address || undefined,
        phone: formData.phone || undefined,
        isActive: formData.isActive,
      };

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        fetchBranches();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setFormError(errJson.message || 'Operation failed');
      }
    } catch (err: any) {
      setFormError(err.message || 'Network error');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Retail Branches" description="Manage your retail store locations." />
        <button onClick={openCreateModal} className="bg-primary hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Add Branch
        </button>
      </div>

      {error ? (
        <ErrorState title="Failed to load branches" description={error} onRetry={fetchBranches} />
      ) : loading ? (
        <div className="bg-surface rounded-xl shadow-sm border border-border-strong overflow-hidden min-h-[300px] animate-pulse" />
      ) : branches.length === 0 ? (
        <div className="text-center pb-8">
          <EmptyState title="No branches found" description="Get started by adding your first retail branch." />
          <button onClick={openCreateModal} className="mt-4 px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 transition">
            Add Branch
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-xl shadow-sm border border-border-strong overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-border-strong text-text-secondary">
              <tr>
                <th className="px-6 py-4 font-medium">Branch Name</th>
                <th className="px-6 py-4 font-medium">Contact & Address</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branches.map(branch => (
                <tr key={branch.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-primary">
                    {branch.name}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <div className="flex flex-col">
                      <span>{branch.phone || '-'}</span>
                      <span className="text-xs text-text-muted">{branch.address}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${branch.isActive ? 'bg-success/10 text-success' : 'bg-surface-muted text-slate-800'}`}>
                      {branch.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEditModal(branch)} className="text-accent hover:text-accent font-medium text-sm">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg text-primary">{editingBranch ? 'Edit Branch' : 'Add Branch'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-slate-600">&times;</button>
            </div>
            
            <div className="overflow-y-auto p-6">
              <form id="branch-form" onSubmit={handleSubmit} className="space-y-4">
                {formError && <div className="p-3 bg-rose-50 text-rose-700 rounded text-sm">{formError}</div>}
                
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Branch Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Phone</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Address</label>
                  <textarea rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm" />
                </div>

                <div className="flex items-center mt-2">
                  <input id="isActive" type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="h-4 w-4 text-accent focus:ring-accent border-border-strong rounded" />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Branch is Active
                  </label>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-muted rounded-md">Cancel</button>
              <button form="branch-form" type="submit" disabled={formLoading} className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent rounded-md disabled:opacity-50">
                {formLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
