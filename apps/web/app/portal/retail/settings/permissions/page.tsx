"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";

const ALL_PERMISSIONS = [
  'RETAIL_DASHBOARD_VIEW',
  'ORDERS_VIEW', 'ORDERS_MANAGE',
  'CUSTOMERS_VIEW', 'CUSTOMERS_MANAGE',
  'INVENTORY_VIEW', 'INVENTORY_ADJUST',
  'CATALOG_VIEW', 'CATALOG_MANAGE',
  'POS_VIEW', 'POS_USE', 'POS_MANAGE',
  'TERMINALS_VIEW', 'TERMINALS_MANAGE',
  'BRANCH_VIEW', 'BRANCH_MANAGE',
  'EMPLOYEES_VIEW', 'EMPLOYEES_MANAGE',
  'RETAIL_SETTINGS_VIEW', 'RETAIL_SETTINGS_MANAGE'
];

interface Employee {
  id: string;
  role: string;
  permissions: string[];
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function EmployeePermissionsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchEmployees = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEmployees(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const togglePermission = async (employee: Employee, permission: string) => {
    if (employee.role === 'ADMIN' || employee.permissions?.includes('*')) return; // Admins bypass permissions anyway
    
    setSaving(employee.id);
    const token = getAccessToken();
    
    const newPermissions = employee.permissions?.includes(permission)
      ? employee.permissions.filter(p => p !== permission)
      : [...(employee.permissions || []), permission];
      
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/employees/${employee.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ permissions: newPermissions })
      });
      if (res.ok) {
        setEmployees(employees.map(e => e.id === employee.id ? { ...e, permissions: newPermissions } : e));
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Failed to update permissions. ${errorData.message || 'Please check your access.'}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4 max-w-4xl"><div className="h-8 bg-slate-200 rounded w-1/4"></div><div className="h-64 bg-slate-100 rounded-xl"></div></div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Employee Permissions" description="Manage access control for your retail staff." />
      
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <ul className="divide-y divide-slate-100">
          {employees.map(employee => (
            <li key={employee.id} className="p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-semibold text-brand-navy">{employee.user.firstName} {employee.user.lastName}</h3>
                  <p className="text-sm text-slate-500">{employee.user.email}</p>
                </div>
                <div className="flex items-center gap-4">
                  {saving === employee.id && <span className="text-xs text-slate-400">Saving...</span>}
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${employee.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                    {employee.role}
                  </span>
                </div>
              </div>
              
              {employee.role === 'ADMIN' || employee.permissions?.includes('*') ? (
                <div className="p-4 bg-indigo-50/50 rounded-lg text-sm text-indigo-800">
                  This user is an Admin and has full access to all features automatically. Specific permissions do not apply.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {ALL_PERMISSIONS.map(perm => (
                    <label key={perm} className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${employee.permissions?.includes(perm) ? 'bg-orange-50 border-orange-200' : 'hover:bg-slate-50 border-slate-200'}`}>
                      <input 
                        type="checkbox" 
                        className="mt-1 rounded text-brand-orange focus:ring-brand-orange border-slate-300"
                        checked={employee.permissions?.includes(perm) || false}
                        onChange={() => togglePermission(employee, perm)}
                        disabled={saving === employee.id}
                      />
                      <span className={`text-xs font-medium ${employee.permissions?.includes(perm) ? 'text-brand-orange' : 'text-slate-600'}`}>
                        {perm.replace('RETAIL_', '').replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </li>
          ))}
          
          {employees.length === 0 && (
            <li className="p-6 text-center text-slate-500 text-sm">No employees found.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
