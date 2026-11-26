import { getApiUrl } from '@/utils/api';
import { buildAuthHeaders, hasBrowserAuth, User } from '@/utils/auth';
import { BusinessCapability, canUseBusinessCapability } from '@/utils/capabilities';

export type DashboardId =
  | 'STUDENT'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'ACCOMMODATION'
  | 'RETAIL'
  | 'FOOD'
  | 'MECHANICS'
  | 'SERVICES'
  | 'RENTALS'
  | 'SETTINGS';

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface DashboardOnboardingRecord {
  id: string | null;
  userId: string;
  dashboardId: DashboardId;
  tutorialVersion: number;
  status: OnboardingStatus;
  lastCompletedStep: number;
  completedAt: string | null;
  skippedAt: string | null;
}

export interface QuickstartGuideSection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  requiredPermissions?: string[];
  requiredCapabilities?: BusinessCapability[];
}

export interface TutorialStepDef {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  route?: string;
  placement?: 'bottom' | 'top' | 'right' | 'left';
  requiredPermissions?: string[];
  requiredCapabilities?: BusinessCapability[];
}

export interface DashboardQuickstartConfig {
  dashboardId: DashboardId;
  title: string;
  subtitle: string;
  tutorialVersion: number;
  targetRoles: string[];
  sections: QuickstartGuideSection[];
  steps: TutorialStepDef[];
}

export function resolveDashboardId(user: User | null, pathname: string): DashboardId | null {
  if (pathname.startsWith('/settings')) {
    return 'SETTINGS';
  }
  if (user?.role === 'SUPER_ADMIN') {
    return 'SUPER_ADMIN';
  }
  if (user?.role === 'ADMIN' || pathname.startsWith('/admin')) {
    return 'ADMIN';
  }
  if (user?.role === 'STUDENT' || pathname.startsWith('/student')) {
    return 'STUDENT';
  }

  if (user?.role !== 'ORG_STAFF') {
    return null;
  }

  const cat = (user?.businessCategory || '').toUpperCase();
  const orgType = (user?.orgType || '').toUpperCase();

  if (cat === 'FOOD' || pathname.startsWith('/portal/business/orders') || pathname.startsWith('/portal/business/menu')) {
    return 'FOOD';
  }
  if (cat === 'MECHANICS') {
    return 'MECHANICS';
  }
  if (cat === 'RENTALS') {
    return 'RENTALS';
  }
  if (cat === 'SERVICES' || pathname.startsWith('/portal/business/appointments')) {
    return 'SERVICES';
  }
  if (cat === 'RETAIL' || orgType === 'RETAIL' || pathname.startsWith('/portal/retail')) {
    return 'RETAIL';
  }
  if (orgType === 'PROVIDER' || orgType === 'AGENCY' || pathname.startsWith('/portal')) {
    return 'ACCOMMODATION';
  }
  return null;
}

export function hasQuickstartAccess(
  user: User | null,
  requiredPermissions?: string[],
  requiredCapabilities?: BusinessCapability[],
): boolean {
  if (!user) return false;

  if (requiredCapabilities && requiredCapabilities.length > 0 && user.role === 'ORG_STAFF') {
    const allowed = requiredCapabilities.some((cap) =>
      canUseBusinessCapability(user.businessCategory as any, cap),
    );
    if (!allowed) return false;
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.orgRole === 'ADMIN') {
      return true;
    }
    const perms = user.permissions || [];
    if (perms.includes('*')) return true;
    return requiredPermissions.some((p) => perms.includes(p));
  }

  return true;
}

export async function fetchDashboardOnboardingState(
  dashboardId: DashboardId,
): Promise<DashboardOnboardingRecord | null> {
  if (!hasBrowserAuth()) return null;
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/onboarding/dashboards/${dashboardId}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: buildAuthHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as DashboardOnboardingRecord;
  } catch {
    return null;
  }
}

export async function updateDashboardOnboardingState(
  dashboardId: DashboardId,
  payload: {
    status: OnboardingStatus;
    tutorialVersion?: number;
    lastCompletedStep?: number;
  },
): Promise<DashboardOnboardingRecord | null> {
  if (!hasBrowserAuth()) return null;
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/onboarding/dashboards/${dashboardId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as DashboardOnboardingRecord;
  } catch {
    return null;
  }
}

export async function resetDashboardOnboardingState(
  dashboardId: DashboardId,
  tutorialVersion = 1,
): Promise<DashboardOnboardingRecord | null> {
  if (!hasBrowserAuth()) return null;
  try {
    const res = await fetch(
      `${getApiUrl()}/api/v1/onboarding/dashboards/${dashboardId}/reset`,
      {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ tutorialVersion }),
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as DashboardOnboardingRecord;
  } catch {
    return null;
  }
}
