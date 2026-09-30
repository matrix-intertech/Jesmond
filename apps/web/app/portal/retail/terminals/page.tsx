"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";

type TerminalStatus = 'ACTIVE' | 'OFFLINE' | 'DISABLED';

interface Terminal {
  id: string;
  name: string;
  externalId?: string;
  status: TerminalStatus;
  branchId: string;
  branch?: { name: string };
  updatedAt: string;
}

export default function TerminalsPage() {
  const router = useRouter();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
  const [formData, setFormData] = useState({ name: '', branchId: '', externalId: '', status: 'ACTIVE' as TerminalStatus });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchTerminals = async () => {
    setLoading(true);
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/terminals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        const json = await res.json();
        setTerminals(json);
      } else {
        setError('Failed to load terminals');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setBranches(json);
      }
    } catch (e) {
      console.error('Failed to load branches', e);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchTerminals();
  }, []);

  const openCreateModal = () => {
    setEditingTerminal(null);
    setFormData({ name: '', branchId: branches.length > 0 ? branches[0].id : '', externalId: '', status: 'ACTIVE' });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (term: Terminal) => {
    setEditingTerminal(term);
    setFormData({ name: term.name, branchId: term.branchId, externalId: term.externalId || '', status: term.status });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    const token = getAccessToken();
    try {
      const isEdit = !!editingTerminal;
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/terminals${isEdit ? `/${editingTerminal.id}` : ''}`;
      
      const payload: any = {
        name: formData.name,
        externalId: formData.externalId || undefined,
      };
      if (isEdit) {
        payload.status = formData.status;
      } else {
        payload.branchId = formData.branchId;
      }

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
        fetchTerminals();
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

  const mapStatusColor = (status: string): any => {
    switch (status) {
      case 'ACTIVE': return 'ENABLED';
      case 'OFFLINE': return 'DISABLED';
      case 'DISABLED': return 'DISABLED';
      default: return 'DRAFT';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Terminals" description="Manage POS terminals across your branches." />
        <button onClick={openCreateModal} className="bg-primary hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Add Terminal
        </button>
      </div>

      {error ? (
        <ErrorState title="Failed to load terminals" description={error} onRetry={fetchTerminals} />
      ) : loading ? (
        <div className="bg-surface rounded-xl shadow-sm border border-border-strong overflow-hidden min-h-[300px] animate-pulse" />
      ) : terminals.length === 0 ? (
        <div className="text-center pb-8">
          <EmptyState title="No terminals found" description="Get started by creating a new POS terminal." />
          <button onClick={openCreateModal} className="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 transition">
            Add Terminal
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-xl shadow-sm border border-border-strong overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-border-strong text-text-secondary">
              <tr>
                <th className="px-6 py-4 font-medium">Terminal Name</th>
                <th className="px-6 py-4 font-medium">Branch</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">External ID</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {terminals.map(term => (
                <tr key={term.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-primary">{term.name}</td>
                  <td className="px-6 py-4 text-slate-600">{term.branch?.name || term.branchId}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={mapStatusColor(term.status)} />
                  </td>
                  <td className="px-6 py-4 text-text-secondary font-mono text-xs">{term.externalId || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEditModal(term)} className="text-accent hover:text-accent font-medium text-sm">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center">
              <h3 className="font-semibold text-lg text-primary">{editingTerminal ? 'Edit Terminal' : 'Add Terminal'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-rose-50 text-rose-700 rounded text-sm">{formError}</div>}
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Terminal Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm" placeholder="e.g. Front Register 1" />
              </div>

              {!editingTerminal && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Branch</label>
                  <select required value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm">
                    {branches.length === 0 && <option value="">No branches available</option>}
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">External ID (Optional)</label>
                <input type="text" value={formData.externalId} onChange={e => setFormData({...formData, externalId: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm font-mono" placeholder="e.g. term_12345" />
              </div>

              {editingTerminal && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as TerminalStatus})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm">
                    <option value="ACTIVE">Active</option>
                    <option value="OFFLINE">Offline</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-muted rounded-md">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent rounded-md disabled:opacity-50">
                  {formLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
