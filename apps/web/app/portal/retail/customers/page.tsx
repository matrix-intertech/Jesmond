"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";

interface Customer {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  externalId?: string;
  createdAt: string;
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    externalId: ''
  });
  
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        const json = await res.json();
        setCustomers(json);
      } else {
        setError('Failed to load customers');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({ firstName: '', lastName: '', email: '', phone: '', address: '', externalId: '' });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormData({
      firstName: cust.firstName,
      lastName: cust.lastName || '',
      email: cust.email || '',
      phone: cust.phone || '',
      address: cust.address || '',
      externalId: cust.externalId || ''
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
      const isEdit = !!editingCustomer;
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/customers${isEdit ? `/${editingCustomer.id}` : ''}`;
      
      // Cleanup empty strings to undefined
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        externalId: formData.externalId || undefined,
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
        fetchCustomers();
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
        <PageHeader title="Customers" description="Manage your retail customer database." />
        <button onClick={openCreateModal} className="bg-brand-navy hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Add Customer
        </button>
      </div>

      {error ? (
        <ErrorState title="Failed to load customers" description={error} onRetry={fetchCustomers} />
      ) : loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[300px] animate-pulse" />
      ) : customers.length === 0 ? (
        <div className="text-center pb-8">
          <EmptyState title="No customers found" description="Get started by adding a retail customer." />
          <button onClick={openCreateModal} className="px-4 py-2 rounded-md bg-brand-navy text-white hover:bg-brand-navy/90 transition">
            Add Customer
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Contact</th>
                <th className="px-6 py-4 font-medium">External ID</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map(cust => (
                <tr key={cust.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-brand-navy">
                    {cust.firstName} {cust.lastName}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <div className="flex flex-col">
                      <span>{cust.email || '-'}</span>
                      <span className="text-xs text-slate-400">{cust.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{cust.externalId || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEditModal(cust)} className="text-brand-orange hover:text-orange-600 font-medium text-sm">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg text-brand-navy">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <div className="overflow-y-auto p-6">
              <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
                {formError && <div className="p-3 bg-rose-50 text-rose-700 rounded text-sm">{formError}</div>}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">External ID</label>
                  <input type="text" value={formData.externalId} onChange={e => setFormData({...formData, externalId: e.target.value})} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange sm:text-sm font-mono" />
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md">Cancel</button>
              <button form="customer-form" type="submit" disabled={formLoading} className="px-4 py-2 text-sm font-medium text-white bg-brand-orange hover:bg-orange-600 rounded-md disabled:opacity-50">
                {formLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
