"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, isAuthenticated } from "@/utils/auth";
import { Loader2 } from "lucide-react";

export type RetailPermission =
  | 'RETAIL_DASHBOARD_VIEW'
  | 'ORDERS_VIEW'
  | 'ORDERS_MANAGE'
  | 'CUSTOMERS_VIEW'
  | 'CUSTOMERS_MANAGE'
  | 'INVENTORY_VIEW'
  | 'INVENTORY_ADJUST'
  | 'CATALOG_VIEW'
  | 'CATALOG_MANAGE'
  | 'POS_VIEW'
  | 'POS_USE'
  | 'POS_MANAGE'
  | 'TERMINALS_VIEW'
  | 'TERMINALS_MANAGE'
  | 'BRANCH_VIEW'
  | 'BRANCH_MANAGE'
  | 'EMPLOYEES_VIEW'
  | 'EMPLOYEES_MANAGE'
  | 'RETAIL_SETTINGS_VIEW'
  | 'RETAIL_SETTINGS_MANAGE';

interface RetailGuardProps {
  children: React.ReactNode;
  requirePermissions?: RetailPermission[];
  requireAll?: boolean;
}

export function hasPermission(required: RetailPermission[], requireAll: boolean = false): boolean {
  const user = getCurrentUser();
  if (!user || user.orgType !== 'RETAIL') return false;

  // Owner override
  if (user.orgRole === 'ADMIN') return true;

  const userPerms = user.permissions || [];
  if (userPerms.includes('*')) return true;

  if (required.length === 0) return true;

  if (requireAll) {
    return required.every(p => userPerms.includes(p));
  } else {
    return required.some(p => userPerms.includes(p));
  }
}

export default function RetailGuard({ children, requirePermissions = [], requireAll = false }: RetailGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [forbidden, setForbidden] = useState<boolean>(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const user = getCurrentUser();
    if (!user || user.orgType !== 'RETAIL') {
      router.push('/student'); // Redirect to generic portal or student portal
      return;
    }

    if (requirePermissions.length > 0) {
      if (!hasPermission(requirePermissions, requireAll)) {
        setForbidden(true);
        return;
      }
    }

    setAuthorized(true);
  }, [router, requirePermissions, requireAll]);

  if (authorized === null && !forbidden) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-brand-orange" size={48} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          You do not have permission to access this module. Please contact your Retail Business Admin if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
