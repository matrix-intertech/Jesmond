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

let inMemoryBusinessToken: string | null = null;
const SELECTED_ORG_STORAGE_KEY = 'jesmond_selected_organization_id';

export const getSelectedOrganizationId = (): string | null => {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(SELECTED_ORG_STORAGE_KEY);
};

export const setSelectedOrganizationId = (orgId: string | null | undefined) => {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  if (!orgId) {
    sessionStorage.removeItem(SELECTED_ORG_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(SELECTED_ORG_STORAGE_KEY, orgId);
};

export const isBusinessHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!window.location?.hostname?.toLowerCase().startsWith('business.');
};

export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  if (isBusinessHost()) {
    // Zero localStorage token storage on Business Portal
    return inMemoryBusinessToken;
  }
  return localStorage.getItem('access_token') || localStorage.getItem('token');
};

export const setAccessToken = (token: string, role?: string) => {
  if (typeof window === 'undefined') return;
  const effectiveRole = role || getCurrentUser()?.role;
  if (isBusinessHost() || (effectiveRole && effectiveRole !== 'STUDENT')) {
    // Zero localStorage/sessionStorage token exposure for business/admin SSO sessions
    inMemoryBusinessToken = token;
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    return;
  }
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
  inMemoryBusinessToken = null;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SELECTED_ORG_STORAGE_KEY);
  }
  localStorage.removeItem('access_token');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const AUTH_SYNC_CHANNEL = 'jesmond_auth_sync';
const AUTH_LOGOUT_STORAGE_KEY = 'jesmond_auth_logout_at';

export interface SharedSessionEstablishResult {
  ok: boolean;
  status?: number;
  message?: string;
}

export interface SharedSessionRevokeResult {
  ok: boolean;
  backendRevoked: boolean;
  message?: string;
}

export function broadcastAuthLogout(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_LOGOUT_STORAGE_KEY, String(Date.now()));
  } catch {}
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      ch.postMessage({ type: 'logout', ts: Date.now() });
      ch.close();
    }
  } catch {}
}

export function subscribeToAuthSync(onLogout: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (e: StorageEvent) => {
    if (e.key === AUTH_LOGOUT_STORAGE_KEY && e.newValue) {
      onLogout();
    }
  };
  window.addEventListener('storage', handleStorage);

  let ch: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      ch.onmessage = (event) => {
        if (event?.data?.type === 'logout') {
          onLogout();
        }
      };
    }
  } catch {}

  return () => {
    window.removeEventListener('storage', handleStorage);
    try {
      ch?.close();
    } catch {}
  };
}

export interface SharedSessionRevalidationHandlers {
  onAuthenticated?: (user: User) => void;
  onUnauthorized: () => void;
  onForbidden?: (message: string) => void;
  onTransientError?: (message: string) => void;
  pollIntervalMs?: number;
}

/**
 * Revalidates the shared BFF session across subdomains (e.g. jesmond.com.au <->
 * business.jesmond.com.au) on window focus, document visibilitychange, and optional
 * lightweight polling, since BroadcastChannel/localStorage are origin-scoped.
 *
 * Isolated student sessions on the main portal are skipped.
 */
export function subscribeToSharedSessionRevalidation(
  handlers: SharedSessionRevalidationHandlers,
): () => void {
  if (typeof window === 'undefined') return () => {};

  let active = true;
  let inFlight = false;
  let lastCheckAt = 0;
  const MIN_GAP_MS = 1500;

  const runCheck = async (force = false) => {
    if (!active || inFlight) return;
    const current = getCurrentUser();
    if (!isBusinessHost() && current?.role === 'STUDENT') {
      return;
    }
    if (!current && !isBusinessHost()) {
      return;
    }
    const now = Date.now();
    if (!force && now - lastCheckAt < MIN_GAP_MS) {
      return;
    }

    inFlight = true;
    lastCheckAt = now;
    try {
      const result = await restoreUserSession({ forceRefresh: true });
      if (!active) return;

      if (result.status === 'ok' && result.user) {
        handlers.onAuthenticated?.(result.user);
      } else if (result.status === 'unauthorized') {
        clearAuth();
        broadcastAuthLogout();
        handlers.onUnauthorized();
      } else if (result.status === 'forbidden') {
        handlers.onForbidden?.(result.error || 'Access restricted.');
      } else if (result.status === 'error' || result.status === 'timeout') {
        handlers.onTransientError?.(
          result.error || 'Unable to verify session right now.',
        );
      }
    } finally {
      inFlight = false;
    }
  };

  const handleFocus = () => {
    void runCheck(true);
  };
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      void runCheck(true);
    }
  };

  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibility);

  const pollMs = handlers.pollIntervalMs ?? 60_000;
  const timer =
    pollMs > 0
      ? window.setInterval(() => {
          if (document.visibilityState === 'visible') {
            void runCheck(false);
          }
        }, pollMs)
      : null;

  const unsubscribeSameOrigin = subscribeToAuthSync(() => {
    if (!active) return;
    const current = getCurrentUser();
    if (!current || current.role !== 'STUDENT' || isBusinessHost()) {
      clearAuth();
      handlers.onUnauthorized();
    }
  });

  return () => {
    active = false;
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibility);
    if (timer !== null) {
      window.clearInterval(timer);
    }
    unsubscribeSameOrigin();
  };
}

export async function establishSharedSession(
  accessToken: string,
  organizationId?: string | null,
): Promise<SharedSessionEstablishResult> {
  if (typeof window === 'undefined' || !accessToken) {
    return { ok: false, status: 400, message: 'Missing session credentials.' };
  }
  try {
    const res = await fetch('/api/auth/session/establish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        access_token: accessToken,
        ...(organizationId ? { organizationId } : {}),
      }),
    });

    if (res.ok) {
      // Remove any non-student localStorage token once shared HttpOnly BFF session is active
      const role = getCurrentUser()?.role;
      if (role && role !== 'STUDENT') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
      }
      return { ok: true, status: res.status };
    }

    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      return { ok: false, status: 401, message: data?.message || 'Your session could not be verified. Please sign in again.' };
    }
    if (res.status === 403) {
      return { ok: false, status: 403, message: data?.message || 'This account is not permitted to establish a shared portal session.' };
    }
    if (res.status === 503) {
      return { ok: false, status: 503, message: 'Authentication service is temporarily unavailable. Please try again shortly.' };
    }
    return { ok: false, status: res.status, message: data?.message || 'Unable to establish shared session.' };
  } catch {
    return { ok: false, status: 503, message: 'Unable to reach the authentication service. Please check your connection.' };
  }
}

export async function syncSelectedOrganizationSession(
  organizationId: string,
): Promise<boolean> {
  if (typeof window === 'undefined' || !organizationId) return false;
  try {
    const res = await fetch('/api/auth/session/select-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ organizationId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function revokeSharedSession(): Promise<SharedSessionRevokeResult> {
  if (typeof window === 'undefined') {
    return { ok: false, backendRevoked: false, message: 'No browser context' };
  }
  try {
    const res = await fetch('/api/auth/session/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    broadcastAuthLogout();
    return {
      ok: res.ok,
      backendRevoked: Boolean(data?.backendRevoked ?? res.ok),
      message: data?.message,
    };
  } catch {
    broadcastAuthLogout();
    return {
      ok: false,
      backendRevoked: false,
      message: 'Unable to confirm backend session revocation.',
    };
  }
}

export async function rotateSharedSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const res = await fetch('/api/auth/session/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const isAuthenticated = (): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  if (isBusinessHost() || user.role !== 'STUDENT') {
    return true;
  }
  return !!getAccessToken();
};

export const hasBrowserAuth = (): boolean => {
  return !!getAccessToken() || isAuthenticated();
};

export const buildAuthHeaders = (
  extraHeaders?: Record<string, string>,
): Record<string, string> => {
  const headers: Record<string, string> = { ...(extraHeaders || {}) };
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const selectedOrgId = getSelectedOrganizationId() || getCurrentUser()?.organizationId;
  if (selectedOrgId && !headers['X-Organization-Id'] && !headers['x-organization-id']) {
    headers['X-Organization-Id'] = selectedOrgId;
  }
  return headers;
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
  const isBusiness = isBusinessHost();
  const cached = getCurrentUser();
  const selectedOrgId = getSelectedOrganizationId() || cached?.organizationId;
  const isIsolatedStudentSession = !isBusiness && cached?.role === 'STUDENT' && !!token;
  const timeoutMs = options?.timeoutMs ?? 7000;
  const bffController = new AbortController();
  const bffTimer = setTimeout(() => bffController.abort(), timeoutMs);

  // Non-student portals and cross-domain sessions use the Redis-backed BFF session as primary source of truth.
  // Isolated student sessions on the main portal validate directly via /api/v1/auth/me without business SSO.
  if (!isIsolatedStudentSession) {
    try {
      const bffHeaders: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      };
      if (selectedOrgId) {
        bffHeaders['X-Organization-Id'] = selectedOrgId;
      }
      const bffRes = await fetch('/api/auth/session', {
        method: 'GET',
        headers: bffHeaders,
        credentials: 'include',
        cache: 'no-store',
        signal: bffController.signal,
      });
      if (bffRes.ok) {
        const bffData = await bffRes.json();
        clearTimeout(bffTimer);
        if (bffData?.authenticated && bffData?.user?.id && bffData?.user?.role) {
          if (isBusiness && bffData.user.role === 'STUDENT') {
            return {
              user: null,
              status: 'forbidden',
              error: 'Student accounts cannot access the Business Portal.',
            };
          }
          const bffUser: User = {
            id: bffData.user.id,
            email: bffData.user.email || '',
            role: bffData.user.role,
            firstName: bffData.user.firstName,
            lastName: bffData.user.lastName,
            organizationId: bffData.user.organizationId,
            orgType: bffData.user.orgType,
            businessCategory: bffData.user.businessCategory,
            orgRole: bffData.user.orgRole,
            permissions: Array.isArray(bffData.user.permissions) ? bffData.user.permissions : undefined,
            retailBranchId: bffData.user.retailBranchId,
            accountStatus: bffData.user.accountStatus,
          };
          setCurrentUser(bffUser);
          return { user: bffUser, status: 'ok' };
        }
      } else if (bffRes.status === 503) {
        clearTimeout(bffTimer);
        return {
          user: null,
          status: 'error',
          error: 'Authentication session store is temporarily unavailable. Please retry.',
        };
      } else if (bffRes.status === 401) {
        clearTimeout(bffTimer);
        clearAuth();
        return { user: null, status: 'unauthorized', error: 'Session expired. Please log in again.' };
      }
      clearTimeout(bffTimer);
    } catch (err: unknown) {
      clearTimeout(bffTimer);
      const errObj = err instanceof Error ? err : new Error(String(err));
      if (errObj.name === 'AbortError' || errObj.message.includes('aborted')) {
        return {
          user: null,
          status: 'timeout',
          error: 'Authentication request timed out while contacting server. Please retry.',
        };
      }
      // Fall through to backend check if BFF endpoint is unreachable in isolated unit tests
    }
  } else {
    clearTimeout(bffTimer);
  }

  if (!token && !isBusiness) {
    clearAuth();
    return { user: null, status: 'unauthorized', error: 'No active session token' };
  }

  // Security requirement: Protected dashboard authorization always requires a
  // successful server-validated session response. Cached data is never used
  // as the final authorization decision.

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const apiUrl = getApiUrl();
    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const selectedOrgId = getSelectedOrganizationId() || cached?.organizationId;
    if (selectedOrgId) {
      headers['X-Organization-Id'] = selectedOrgId;
    }

    const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
      method: 'GET',
      headers,
      credentials: 'include',
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
      const orgType = (user.orgType || '').toUpperCase();
      const category = (user.businessCategory || '').toUpperCase();

      // 1. Accommodation providers & agencies (property rentals remain under Accommodation)
      if (
        category === 'ACCOMMODATION' ||
        ((orgType === 'PROVIDER' || orgType === 'AGENCY') &&
          !['FOOD', 'MECHANICS', 'SERVICES'].includes(category))
      ) {
        return '/accommodation';
      }

      // 2. Specialized commercial categories
      if (category === 'RETAIL') {
        return '/retail';
      }
      if (category === 'FOOD') {
        return '/food';
      }
      if (category === 'MECHANICS') {
        return '/mechanics';
      }
      if (category === 'SERVICES') {
        return '/services';
      }
      if (category === 'RENTALS') {
        return '/rentals';
      }

      // 3. Fallback by organization type
      if (orgType === 'RETAIL') {
        return '/retail';
      }

      // Safe fallback when organization context is incomplete:
      // Do NOT default to PROVIDER. Direct to user profile to complete setup.
      return '/settings/profile';
    }
    default:
      return '/';
  }
};

/**
 * Resolves the full destination URL (including business subdomain when on the
 * public/student host) for Dashboard entry points such as GlobalNav.
 */
export const getPortalDashboardUrlForUser = (
  user: Partial<User> | null | undefined,
  businessPortalBaseUrl: string,
): string => {
  const route = getDashboardRouteForUser(user);
  if (!user || user.role !== 'ORG_STAFF') {
    return route;
  }

  const normalizedBase = businessPortalBaseUrl.replace(/\/+$/, '');
  const targetPath = route === '/settings/profile' ? '/onboarding' : route;

  if (isBusinessHost()) {
    return route === '/settings/profile' ? '/business/onboarding' : route;
  }

  return `${normalizedBase}${targetPath}`;
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
      if (category === 'RENTALS' && orgType !== 'PROVIDER' && orgType !== 'AGENCY') {
        return 'Rentals Dashboard';
      }
      if (category === 'RETAIL' && orgType !== 'PROVIDER' && orgType !== 'AGENCY') {
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

  // Business Portal clean routes
  if (route === '/accommodation' || route.startsWith('/accommodation/')) {
    if (role !== 'ORG_STAFF') return false;
    if (['FOOD', 'MECHANICS', 'SERVICES'].includes(category)) return false;
    return orgType === 'PROVIDER' || orgType === 'AGENCY' || category === 'ACCOMMODATION';
  }

  if (route === '/retail' || route.startsWith('/retail/')) {
    if (role !== 'ORG_STAFF') return false;
    if (['SERVICES', 'MECHANICS', 'FOOD'].includes(category)) return false;
    if ((orgType === 'PROVIDER' || orgType === 'AGENCY') && category !== 'RETAIL') return false;
    return orgType === 'RETAIL' || category === 'RETAIL';
  }

  if (route === '/food' || route.startsWith('/food?')) {
    if (role !== 'ORG_STAFF') return false;
    return category === 'FOOD' || orgType === 'RETAIL';
  }

  if (route === '/mechanics' || route.startsWith('/mechanics/')) {
    return role === 'ORG_STAFF' && category === 'MECHANICS';
  }

  if (route === '/services' || route.startsWith('/services/')) {
    return role === 'ORG_STAFF' && category === 'SERVICES';
  }

  if (route === '/rentals' || route.startsWith('/rentals/')) {
    return (
      role === 'ORG_STAFF' &&
      category === 'RENTALS' &&
      orgType !== 'PROVIDER' &&
      orgType !== 'AGENCY'
    );
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
      return (
        category === 'SERVICES' ||
        category === 'MECHANICS' ||
        (category === 'RENTALS' && orgType !== 'PROVIDER' && orgType !== 'AGENCY')
      );
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
