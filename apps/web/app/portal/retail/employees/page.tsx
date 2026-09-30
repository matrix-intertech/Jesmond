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
}

interface UserData {
 id: string;
 email: string;
 firstName: string;
 lastName?: string;
 accountStatus: string;
}

interface Employee {
 id: string;
 role: string;
 userId: string;
 user: UserData;
 retailBranch?: Branch;
 retailBranchId?: string;
 branches?: { branch: Branch }[];
}

import RetailGuard from "@/components/retail/RetailGuard";

function EmployeesPageContent() {
 const router = useRouter();
 const [employees, setEmployees] = useState<Employee[]>([]);
 const [branches, setBranches] = useState<Branch[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");

 const [isModalOpen, setIsModalOpen] = useState(false);
 const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

 const [formData, setFormData] = useState({
 firstName: '',
 lastName: '',
 email: '',
 role: 'ORG_STAFF',
 branchIds: [] as string[],
 accountStatus: 'ACTIVE'
 });

 const [formLoading, setFormLoading] = useState(false);
 const [formError, setFormError] = useState("");

 const fetchData = async () => {
 setLoading(true);
 const token = getAccessToken();
 if (!token) return;
 try {
 const [empRes, brRes] = await Promise.all([
 fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/employees`, { headers: { Authorization: `Bearer ${token}` } }),
 fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/branches`, { headers: { Authorization: `Bearer ${token}` } })
 ]);

 await handleApiError(empRes, () => { clearAuth(); router.replace('/login'); });

 if (empRes.ok && brRes.ok) {
 setEmployees(await empRes.json());
 setBranches(await brRes.json());
 } else {
 setError('Failed to load data');
 }
 } catch (e: any) {
 setError(e.message);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, []);

 const openCreateModal = () => {
 setEditingEmployee(null);
 setFormData({ firstName: '', lastName: '', email: '', role: 'ORG_STAFF', branchIds: [], accountStatus: 'ACTIVE' });
 setFormError("");
 setIsModalOpen(true);
 };

 const openEditModal = (emp: Employee) => {
 setEditingEmployee(emp);
 setFormData({
 firstName: emp.user.firstName,
 lastName: emp.user.lastName || '',
 email: emp.user.email,
 role: emp.role,
 branchIds: emp.branches?.map(b => b.branch.id) || (emp.retailBranch?.id ? [emp.retailBranch.id] : []),
 accountStatus: emp.user.accountStatus,
 });
 setFormError("");
 setIsModalOpen(true);
 };

 const deactivateEmployee = async (empId: string) => {
 if (!confirm('Are you sure you want to deactivate this employee? They will no longer be able to log in.')) return;

 const token = getAccessToken();
 try {
 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/employees/${empId}`, {
 method: 'DELETE',
 headers: { 'Authorization': `Bearer ${token}` },
 });
 if (res.ok) {
 fetchData();
 } else {
 alert('Failed to deactivate employee');
 }
 } catch (err) {
 console.error(err);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormLoading(true);
 setFormError("");
 const token = getAccessToken();
 try {
 const isEdit = !!editingEmployee;
 const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/employees${isEdit ? `/${editingEmployee.id}` : ''}`;

 let payload: any = {};
 if (isEdit) {
 payload = {
 role: formData.role,
 branchIds: formData.branchIds,
 accountStatus: formData.accountStatus,
 };
 } else {
 payload = {
 firstName: formData.firstName,
 lastName: formData.lastName || undefined,
 email: formData.email,
 role: formData.role,
 branchIds: formData.branchIds,
 };
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
 fetchData();
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
 <PageHeader title="Retail Employees" description="Manage your staff and branch assignments." />
 <button onClick={openCreateModal} className="bg-primary hover:bg-surface-muted text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
 Add Employee
 </button>
 </div>

 {error ? (
 <ErrorState title="Failed to load employees" description={error} onRetry={fetchData} />
 ) : loading ? (
 <div className="bg-surface rounded-xl shadow-sm border border-border-strong overflow-hidden min-h-[300px] animate-pulse" />
 ) : employees.length === 0 ? (
 <div className="text-center pb-8">
 <EmptyState title="No employees found" description="Get started by adding your first retail employee." />
 <button onClick={openCreateModal} className="mt-4 px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 transition">
 Add Employee
 </button>
 </div>
 ) : (
 <div className="bg-surface rounded-xl shadow-sm border border-border-strong overflow-hidden">
 <table className="w-full text-sm text-left">
 <thead className="bg-surface-lavender border-b border-border-strong text-text-secondary">
 <tr>
 <th className="px-6 py-4 font-medium">Employee Name</th>
 <th className="px-6 py-4 font-medium">Role & Branch</th>
 <th className="px-6 py-4 font-medium">Account Status</th>
 <th className="px-6 py-4 font-medium text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {employees.map(emp => (
 <tr key={emp.id} className="hover:bg-surface-lavender transition-colors">
 <td className="px-6 py-4 font-medium text-primary">
 <div className="flex flex-col">
 <span>{emp.user.firstName} {emp.user.lastName}</span>
 <span className="text-xs text-text-muted font-normal">{emp.user.email}</span>
 </div>
 </td>
 <td className="px-6 py-4 text-text-secondary">
 <div className="flex flex-col">
 <span className="font-medium text-text-primary">{emp.role.replace('_', ' ')}</span>
 <span className="text-xs text-text-muted">
 {emp.branches && emp.branches.length > 0
 ? emp.branches.map(b => b.branch.name).join(', ')
 : (emp.retailBranch?.name || 'No branch assigned')}
 </span>
 </div>
 </td>
 <td className="px-6 py-4">
 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
 emp.user.accountStatus === 'ACTIVE' ? 'bg-success/10 text-success' :
 emp.user.accountStatus === 'PENDING_VERIFICATION' ? 'bg-amber-100 text-amber-800' :
 'bg-surface-muted text-text-primary'
 }`}>
 {emp.user.accountStatus.replace('_', ' ')}
 </span>
 </td>
 <td className="px-6 py-4 text-right">
 <button onClick={() => openEditModal(emp)} className="text-accent hover:text-accent font-medium text-sm mr-4">Edit</button>
 {emp.user.accountStatus !== 'DEACTIVATED' && (
 <button onClick={() => deactivateEmployee(emp.id)} className="text-rose-500 hover:text-rose-700 font-medium text-sm">Deactivate</button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {isModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-muted/50 backdrop-blur-sm">
 <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
 <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center shrink-0">
 <h3 className="font-semibold text-lg text-primary">{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h3>
 <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-secondary">&times;</button>
 </div>

 <div className="overflow-y-auto p-6">
 <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">
 {formError && <div className="p-3 bg-rose-50 text-rose-700 rounded text-sm">{formError}</div>}

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-text-primary mb-1">First Name</label>
 <input disabled={!!editingEmployee} required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm disabled:bg-surface-lavender disabled:text-text-secondary" />
 </div>
 <div>
 <label className="block text-sm font-medium text-text-primary mb-1">Last Name</label>
 <input disabled={!!editingEmployee} type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm disabled:bg-surface-lavender disabled:text-text-secondary" />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-text-primary mb-1">Email (Login ID)</label>
 <input disabled={!!editingEmployee} required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm disabled:bg-surface-lavender disabled:text-text-secondary" />
 {!editingEmployee && <p className="text-xs text-text-secondary mt-1">An email will be sent to them to set their password.</p>}
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-text-primary mb-1">Role</label>
 <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm">
 <option value="ORG_STAFF">Staff</option>
 <option value="ADMIN">Admin</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-text-primary mb-1">Assigned Branches</label>
 <div className="space-y-2 max-h-32 overflow-y-auto p-2 border border-border-strong rounded-md">
 {branches.map(b => (
 <label key={b.id} className="flex items-center space-x-2 text-sm text-text-primary cursor-pointer">
 <input
 type="checkbox"
 checked={formData.branchIds.includes(b.id)}
 onChange={(e) => {
 const checked = e.target.checked;
 setFormData(prev => ({
 ...prev,
 branchIds: checked
 ? [...prev.branchIds, b.id]
 : prev.branchIds.filter(id => id !== b.id)
 }));
 }}
 className="rounded border-border-strong text-accent focus:ring-accent"
 />
 <span>{b.name}</span>
 </label>
 ))}
 {branches.length === 0 && <span className="text-xs text-text-muted">No branches available</span>}
 </div>
 </div>
 </div>

 {editingEmployee && (
 <div>
 <label className="block text-sm font-medium text-text-primary mb-1">Account Status</label>
 <select value={formData.accountStatus} onChange={e => setFormData({...formData, accountStatus: e.target.value})} className="w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm">
 <option value="ACTIVE">Active</option>
 <option value="PENDING_VERIFICATION">Pending Verification</option>
 <option value="SUSPENDED">Suspended</option>
 <option value="DEACTIVATED">Deactivated</option>
 </select>
 </div>
 )}
 </form>
 </div>

 <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3 shrink-0">
 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-muted rounded-md">Cancel</button>
 <button form="employee-form" type="submit" disabled={formLoading} className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent rounded-md disabled:opacity-50">
 {formLoading ? 'Saving...' : 'Save'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

export default function EmployeesPage() {
 return (
 <RetailGuard requirePermissions={['EMPLOYEES_VIEW']}>
 <EmployeesPageContent />
 </RetailGuard>
 );
}
