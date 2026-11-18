export interface User {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  orgType?: string;
  businessCategory?: string;
  orgRole?: string;
  permissions?: string[];
  retailBranchId?: string;
  accountStatus: string;
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
  } catch (e) {
    return null;
  }
};

export const setCurrentUser = (user: User) => {
  if (typeof window === 'undefined') return;
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

      if (orgType === 'PROVIDER' || orgType === 'AGENCY') {
        return '/portal';
      }

      if (orgType === 'RETAIL') {
        if (category === 'SERVICES' || category === 'MECHANICS') {
          return '/portal/business/appointments';
        }
        if (category === 'FOOD') {
          return '/portal/business/orders';
        }
        return '/portal/retail';
      }

      // If orgType is missing or unresolved, attempt category-level routing
      if (category === 'SERVICES' || category === 'MECHANICS') {
        return '/portal/business/appointments';
      }
      if (category === 'FOOD') {
        return '/portal/business/orders';
      }
      if (category === 'RETAIL') {
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
      if (orgType !== 'RETAIL') return false;
      if (category === 'SERVICES' || category === 'MECHANICS') return false;
      return true;
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
      return orgType === 'PROVIDER' || orgType === 'AGENCY';
    }

    return true;
  }

  return true;
};
