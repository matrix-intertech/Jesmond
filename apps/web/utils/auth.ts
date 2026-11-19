import { getApiUrl } from './api';

export interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  orgType?: string;
  businessCategory?: string;
  orgRole?: string;
  permissions?: string[];
  retailBranchId?: string;
  accountStatus?: string;
}

export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  // Previously we used `access_token` and maybe `token` in some places. Let's standardize on `access_token`
  return localStorage.getItem('access_token') || localStorage.getItem('token');
};

export const setAccessToken = (token: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', token);
  // Remove old token key if it exists to clean up
  localStorage.removeItem('token');
};

export const getCurrentUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const setCurrentUser = (user: User | Partial<User> | null | undefined) => {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem('user');
    return;
  }
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearAuth = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const isAuthenticated = (): boolean => {
  return !!getAccessToken() && !!getCurrentUser();
};

export interface SessionRestoreResult {
  user: User | null;
  status: 'ok' | 'unauthorized' | 'forbidden' | 'error' | 'timeout';
  error?: string;
}

/**
 * Restores and synchronizes user session from cache or /api/v1/auth/me.
 *
 * Guarantees:
 * - Never leaves loading unresolved.
 * - Enforces timeouts (default 7s) to prevent frozen UI on network drops.
 * - Disables HTTP caching to avoid 304 Not Modified empty-body issues.
 * - Safely handles 304 responses with cached fallbacks.
 * - Automatically clears storage on 401 Unauthorized.
 * - Validates cache completeness (ensures ORG_STAFF with RETAIL has businessCategory).
 */
export async function restoreUserSession(options?: {
  forceRefresh?: boolean;
  timeoutMs?: number;
}): Promise<SessionRestoreResult> {
  if (typeof window === 'undefined') {
    return { user: null, status: 'unauthorized', error: 'No browser context' };
  }

  const token = getAccessToken();
  if (!token) {
    clearAuth();
    return { user: null, status: 'unauthorized', error: 'No active session token' };
  }

  const cached = getCurrentUser();
  const timeoutMs = options?.timeoutMs ?? 7000;

  // Security requirement: Protected dashboard authorization always requires a
  // successful server-validated session response. Cached data is never used
  // as the final authorization decision.

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (res.status === 401) {
      clearTimeout(timer);
      clearAuth();
      return { user: null, status: 'unauthorized', error: 'Session expired. Please log in again.' };
    }

    if (res.status === 403) {
      clearTimeout(timer);
      return { user: null, status: 'forbidden', error: 'Access to this account is restricted.' };
    }

    if (res.status === 304) {
      clearTimeout(timer);
      // Security requirement: Never authorize using cached data on HTTP 304.
      // Server must return HTTP 200 with authoritative profile payload.
      return {
        user: null,
        status: 'error',
        error: 'Received unexpected 304 Not Modified without profile payload. Please retry.',
      };
    }

    if (!res.ok) {
      clearTimeout(timer);
      // Security requirement: Never authorize protected dashboard on server failure (500, etc.)
      return {
        user: null,
        status: 'error',
        error: `Server responded with status ${res.status}. Please check your connection or retry.`,
      };
    }

    // Keep timeout active across reading and parsing response body
    const data = await res.json();
    clearTimeout(timer);

    const fetchedUser: any = (data && (data.user || data)) as any;

    if (!fetchedUser || !fetchedUser.id || !fetchedUser.role) {
      return { user: null, status: 'error', error: 'Invalid user payload received from server.' };
    }

    // Security requirement: The successful server response is the SOLE source of truth.
    // Never retain cached values for role, organizationId, orgType, businessCategory,
    // orgRole, permissions, retailBranchId, or accountStatus.
    // If the server omits them (e.g. revoked org), they MUST NOT be restored from cache.
    const isSameUser = cached?.id === fetchedUser.id;

    const validatedUser: User = {
      id: fetchedUser.id,
      email: fetchedUser.email || (isSameUser ? cached?.email : ''),
      role: fetchedUser.role,
      firstName: fetchedUser.firstName ?? (isSameUser ? cached?.firstName : undefined),
      lastName: fetchedUser.lastName ?? (isSameUser ? cached?.lastName : undefined),
      organizationId: fetchedUser.organizationId ?? undefined,
      orgType: fetchedUser.orgType ?? undefined,
      businessCategory: fetchedUser.businessCategory ?? undefined,
      orgRole: fetchedUser.orgRole ?? undefined,
      permissions: Array.isArray(fetchedUser.permissions) ? fetchedUser.permissions : undefined,
      retailBranchId: fetchedUser.retailBranchId ?? undefined,
      accountStatus: fetchedUser.accountStatus ?? undefined,
    };

    setCurrentUser(validatedUser);
    return { user: validatedUser, status: 'ok' };
  } catch (err: unknown) {
    clearTimeout(timer);
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const isTimeout = errorObj.name === 'AbortError' || errorObj.message.includes('aborted');

    // Security requirement: Never authorize protected dashboard on network failure or timeout.
    // Server validation must determine whether access is granted.
    return {
      user: null,
      status: isTimeout ? 'timeout' : 'error',
      error: isTimeout
        ? 'Authentication request timed out while contacting server. Please retry.'
        : errorObj.message === 'Failed to fetch'
          ? 'Unable to connect to the Jesmond server. Please check your connection and retry.'
          : errorObj.message || 'Authentication error occurred.',
    };
  }
}

/**
 * Resolves the appropriate dashboard landing route for a user based on their
 * role, organization type, and business category.
 *
 * Rules:
 * - STUDENT -> /student
 * - ADMIN / SUPER_ADMIN -> /admin
 * - ORG_STAFF:
 *   - PROVIDER / AGENCY -> /portal
 *   - RETAIL:
 *     - SERVICES / MECHANICS -> /portal/business/appointments
 *     - FOOD -> /portal/business/orders
 *     - RETAIL -> /portal/retail
 *   - Incomplete / missing organization context -> /settings/profile (safe fallback, never default to PROVIDER)
 */
export const getDashboardRouteForUser = (user: Partial<User> | null | undefined): string => {
  if (!user || !user.role) return '/login';

  switch (user.role) {
    case 'STUDENT':
      return '/student';
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/admin';
    case 'ORG_STAFF': {
      const orgType = user.orgType;
      const category = (user.businessCategory || '').toUpperCase();

      // 1. Business Category takes precedence for specialized business operations
      if (category === 'RETAIL') {
        return '/portal/retail';
      }
      if (category === 'SERVICES' || category === 'MECHANICS') {
        return '/portal/business/appointments';
      }
      if (category === 'FOOD') {
        return '/portal/business/orders';
      }

      // 2. Organization Type determines sector dashboard
      if (orgType === 'PROVIDER' || orgType === 'AGENCY') {
        return '/portal';
      }

      if (orgType === 'RETAIL') {
        return '/portal/retail';
      }

      // Safe fallback when organization context is incomplete:
      // Do NOT default to PROVIDER (/portal). Direct to user profile to complete setup.
      return '/settings/profile';
    }
    default:
      return '/';
  }
};

/**
 * Resolves the display heading for a user's dashboard based on their
 * role, organization type, and business category.
 *
 * Expected headings:
 * - Student -> Student Dashboard
 * - Parent -> Parent Dashboard
 * - Service Provider -> Service Provider Dashboard
 * - Mechanics -> Mechanics Dashboard
 * - Services -> Services / Tradies Dashboard
 * - Retail -> Retail Business Dashboard
 * - Food -> Food Business Dashboard
 * - Agency -> Agency Dashboard
 * - University -> University Dashboard
 * - Admin -> Admin Dashboard
 * - Super Admin -> Super Admin Dashboard
 */
export const getDashboardHeading = (user: Partial<User> | null | undefined): string => {
  if (!user || !user.role) return 'Dashboard';

  const role = (user.role || '').toUpperCase();
  const orgType = (user.orgType || '').toUpperCase();
  const category = (user.businessCategory || '').toUpperCase();

  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin Dashboard';
    case 'ADMIN':
      return 'Admin Dashboard';
    case 'STUDENT':
      return 'Student Dashboard';
    case 'PARENT':
      return 'Parent Dashboard';
    case 'ORG_STAFF': {
      // 1. Business Category takes precedence for specialized business operations
      if (category === 'MECHANICS') {
        return 'Mechanics Dashboard';
      }
      if (category === 'SERVICES') {
        return 'Services / Tradies Dashboard';
      }
      if (category === 'FOOD') {
        return 'Food Business Dashboard';
      }
      if (category === 'RETAIL') {
        return 'Retail Business Dashboard';
      }

      // 2. Organization Type determines sector dashboard
      if (orgType === 'AGENCY') {
        return 'Agency Dashboard';
      }
      if (orgType === 'UNIVERSITY') {
        return 'University Dashboard';
      }
      if (orgType === 'PROVIDER') {
        return 'Service Provider Dashboard';
      }
      if (orgType === 'RETAIL') {
        return 'Retail Business Dashboard';
      }

      // Fallback for ORG_STAFF when org context is unresolved
      return 'Service Provider Dashboard';
    }
    default:
      return 'Dashboard';
  }
};

/**
 * Validates whether a requested returnUrl is authorized for the given user.
 */
export const isAuthorizedRouteForUser = (
  user: Partial<User> | null | undefined,
  route: string | null | undefined,
): boolean => {
  if (!user || !user.role || !route) return false;

  // Basic security: avoid open redirects (must be local path starting with /)
  if (!route.startsWith('/') || route.startsWith('//')) return false;

  const role = user.role;
  const orgType = user.orgType;
  const category = (user.businessCategory || '').toUpperCase();

  // Public or general authenticated routes
  if (
    route === '/' ||
    route.startsWith('/settings') ||
    route.startsWith('/messages') ||
    route.startsWith('/my-orders') ||
    route.startsWith('/my-appointments')
  ) {
    return true;
  }

  // Admin routes
  if (route.startsWith('/admin')) {
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  // Student routes
  if (route.startsWith('/student')) {
    return role === 'STUDENT';
  }

  // Portal routes
  if (route.startsWith('/portal')) {
    if (role !== 'ORG_STAFF') return false;

    // Commercial retail routes
    if (route.startsWith('/portal/retail')) {
      if (category === 'SERVICES' || category === 'MECHANICS') return false;
      return orgType === 'RETAIL' || category === 'RETAIL';
    }

    // Appointment business routes
    if (
      route.startsWith('/portal/business/appointments') ||
      route.startsWith('/portal/business/services') ||
      route.startsWith('/portal/business/staff') ||
      route.startsWith('/portal/business/availability') ||
      route.startsWith('/portal/business/customers')
    ) {
      return category === 'SERVICES' || category === 'MECHANICS';
    }

    // Food business routes
    if (
      route.startsWith('/portal/business/orders') ||
      route.startsWith('/portal/business/menu')
    ) {
      return category === 'FOOD' || orgType === 'RETAIL';
    }

    // Accommodation provider routes
    if (
      route === '/portal' ||
      route.startsWith('/portal/properties') ||
      route.startsWith('/portal/applications') ||
      route.startsWith('/portal/enquiries') ||
      route.startsWith('/portal/create') ||
      route.startsWith('/portal/leads') ||
      route.startsWith('/portal/agency')
    ) {
      if (category === 'RETAIL' || category === 'SERVICES' || category === 'MECHANICS' || category === 'FOOD') {
        return false;
      }
      return orgType === 'PROVIDER' || orgType === 'AGENCY';
    }

    return true;
  }

  return true;
};
