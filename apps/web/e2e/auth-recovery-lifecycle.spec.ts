import { test, expect } from '@playwright/test';
import {
  restoreUserSession,
  getDashboardRouteForUser,
  isAuthorizedRouteForUser,
  setCurrentUser,
  clearAuth,
  setAccessToken,
  getCurrentUser,
  getAccessToken,
  User,
} from '../utils/auth';
import { handleApiError } from '../utils/api';

// Polyfill window and localStorage for node-based testing of auth utility
class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

test.describe('Jesmond 2.0 - Auth Recovery Lifecycle & Dashboard Routing', () => {
  const originalFetch = global.fetch;

  test.beforeEach(() => {
    (global as any).window = {};
    (global as any).localStorage = new MockLocalStorage();
    clearAuth();
  });

  test.afterEach(() => {
    global.fetch = originalFetch;
    delete (global as any).window;
    delete (global as any).localStorage;
  });

  test.describe('1. Role-Based Dashboard Routing Rules', () => {
    test('STUDENT maps to /student', () => {
      expect(getDashboardRouteForUser({ role: 'STUDENT' })).toBe('/student');
    });

    test('ADMIN and SUPER_ADMIN map to /admin', () => {
      expect(getDashboardRouteForUser({ role: 'ADMIN' })).toBe('/admin');
      expect(getDashboardRouteForUser({ role: 'SUPER_ADMIN' })).toBe('/admin');
    });

    test('ORG_STAFF + PROVIDER / AGENCY maps to /accommodation', () => {
      expect(getDashboardRouteForUser({ role: 'ORG_STAFF', orgType: 'PROVIDER' })).toBe('/accommodation');
      expect(getDashboardRouteForUser({ role: 'ORG_STAFF', orgType: 'AGENCY' })).toBe('/accommodation');
    });

    test('ORG_STAFF + RETAIL + SERVICES / MECHANICS maps to /services and /mechanics', () => {
      expect(getDashboardRouteForUser({ role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'SERVICES' })).toBe(
        '/services',
      );
      expect(getDashboardRouteForUser({ role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'MECHANICS' })).toBe(
        '/mechanics',
      );
    });

    test('ORG_STAFF + RETAIL + FOOD maps to /food', () => {
      expect(getDashboardRouteForUser({ role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'FOOD' })).toBe(
        '/food',
      );
    });

    test('ORG_STAFF + RETAIL + RETAIL / RENTALS maps to /retail and /rentals', () => {
      expect(getDashboardRouteForUser({ role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'RETAIL' })).toBe(
        '/retail',
      );
      expect(getDashboardRouteForUser({ role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'RENTALS' })).toBe(
        '/rentals',
      );
    });

    test('ORG_STAFF with incomplete/missing organization context safely routes to /settings/profile', () => {
      expect(getDashboardRouteForUser({ role: 'ORG_STAFF' })).toBe('/settings/profile');
      expect(getDashboardRouteForUser({ role: 'ORG_STAFF', orgType: undefined })).toBe('/settings/profile');
    });

    test('Null, undefined or empty user maps to /login', () => {
      expect(getDashboardRouteForUser(null)).toBe('/login');
      expect(getDashboardRouteForUser(undefined)).toBe('/login');
      expect(getDashboardRouteForUser({})).toBe('/login');
    });
  });

  test.describe('2. Route Authorization & Boundary Enforcement', () => {
    test('Protects against open redirects', () => {
      const user: User = { id: 'u1', email: 's@test.com', role: 'STUDENT' };
      expect(isAuthorizedRouteForUser(user, 'http://evil.com')).toBe(false);
      expect(isAuthorizedRouteForUser(user, '//evil.com')).toBe(false);
      expect(isAuthorizedRouteForUser(user, 'javascript:alert(1)')).toBe(false);
    });

    test('Student authorized for /student, blocked from /admin and /portal', () => {
      const student: User = { id: 'u1', email: 'student@test.com', role: 'STUDENT' };
      expect(isAuthorizedRouteForUser(student, '/student')).toBe(true);
      expect(isAuthorizedRouteForUser(student, '/student/saved')).toBe(true);
      expect(isAuthorizedRouteForUser(student, '/admin')).toBe(false);
      expect(isAuthorizedRouteForUser(student, '/portal')).toBe(false);
      expect(isAuthorizedRouteForUser(student, '/portal/retail')).toBe(false);
    });

    test('Admin authorized for /admin, blocked from student/portal-only contexts', () => {
      const admin: User = { id: 'u2', email: 'admin@test.com', role: 'ADMIN' };
      expect(isAuthorizedRouteForUser(admin, '/admin')).toBe(true);
      expect(isAuthorizedRouteForUser(admin, '/admin/users')).toBe(true);
      expect(isAuthorizedRouteForUser(admin, '/student')).toBe(false);
      expect(isAuthorizedRouteForUser(admin, '/portal/retail')).toBe(false);
    });

    test('Service Provider authorized for appointments, blocked from retail commerce', () => {
      const sp: User = { id: 'u3', email: 'sp@test.com', role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'SERVICES' };
      expect(isAuthorizedRouteForUser(sp, '/portal/business/appointments')).toBe(true);
      expect(isAuthorizedRouteForUser(sp, '/portal/business/services')).toBe(true);
      expect(isAuthorizedRouteForUser(sp, '/portal/retail')).toBe(false);
      expect(isAuthorizedRouteForUser(sp, '/portal/retail/pos')).toBe(false);
    });

    test('Accommodation Provider authorized for /portal and properties, blocked from retail', () => {
      const prov: User = { id: 'u4', email: 'prov@test.com', role: 'ORG_STAFF', orgType: 'PROVIDER' };
      expect(isAuthorizedRouteForUser(prov, '/portal')).toBe(true);
      expect(isAuthorizedRouteForUser(prov, '/portal/properties')).toBe(true);
      expect(isAuthorizedRouteForUser(prov, '/portal/retail')).toBe(false);
      expect(isAuthorizedRouteForUser(prov, '/portal/business/appointments')).toBe(false);
    });
  });

  test.describe('3. Session Recovery Lifecycle & Cache Intelligence', () => {
    test('Valid cached profile with server 200: always contacts server and applies server-validated profile', async () => {
      setAccessToken('valid-token-123');
      const studentCached: User = { id: 's-1', email: 'cached@test.com', role: 'STUDENT' };
      setCurrentUser(studentCached);

      let fetchCalled = false;
      global.fetch = async () => {
        fetchCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 's-1',
            email: 'authoritative@test.com',
            role: 'STUDENT',
          }),
        } as any;
      };

      const result = await restoreUserSession();
      expect(fetchCalled).toBe(true);
      expect(result.status).toBe('ok');
      expect(result.user?.id).toBe('s-1');
      expect(result.user?.email).toBe('authoritative@test.com');
      expect(getCurrentUser()?.email).toBe('authoritative@test.com');
    });

    test('Valid cached profile with server 401: clears auth and does not authorize', async () => {
      setAccessToken('expired-token');
      setCurrentUser({ id: 'u-1', email: 'test@test.com', role: 'STUDENT' });

      global.fetch = async () => ({
        ok: false,
        status: 401,
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('unauthorized');
      expect(result.user).toBeNull();
      expect(getAccessToken()).toBeNull();
      expect(getCurrentUser()).toBeNull();
    });

    test('Valid cached profile with server 403: returns forbidden and does not authorize', async () => {
      setAccessToken('valid-token');
      setCurrentUser({ id: 'u-suspended', email: 'susp@test.com', role: 'STUDENT' });

      global.fetch = async () => ({
        ok: false,
        status: 403,
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('forbidden');
      expect(result.user).toBeNull();
      expect(result.error).toContain('restricted');
    });

    test('Valid cached profile with server 500: returns error and does not authorize', async () => {
      setAccessToken('valid-token');
      setCurrentUser({ id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' });

      global.fetch = async () => ({
        ok: false,
        status: 500,
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('error');
      expect(result.user).toBeNull();
      expect(result.error).toContain('500');
    });

    test('Valid cached profile with server 304: returns error and does not authorize using cached data', async () => {
      setAccessToken('valid-token');
      const student: User = { id: 's-cached', email: 'cached@test.com', role: 'STUDENT' };
      setCurrentUser(student);

      global.fetch = async () => ({
        ok: false,
        status: 304,
        json: async () => { throw new SyntaxError('Unexpected end of JSON input'); },
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('error');
      expect(result.user).toBeNull();
      expect(result.error).toContain('304 Not Modified');
    });

    test('Cached PROVIDER, server response without orgType (realistic JSON omission): routes to /settings/profile', async () => {
      setAccessToken('valid-token');
      // Cached had valid PROVIDER and organizationId
      setCurrentUser({
        id: 'org-user-1',
        email: 'user@test.com',
        role: 'ORG_STAFF',
        orgType: 'PROVIDER',
        organizationId: 'org-123',
      });

      // Realistic JSON response where revoked fields are omitted entirely
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => JSON.parse('{"id":"org-user-1","email":"user@test.com","role":"ORG_STAFF"}'),
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('ok');
      expect(result.user?.orgType).toBeUndefined();
      expect(result.user?.organizationId).toBeUndefined();
      expect(getDashboardRouteForUser(result.user)).toBe('/settings/profile');
      expect(getCurrentUser()?.orgType).toBeUndefined();
      expect(getCurrentUser()?.organizationId).toBeUndefined();
    });

    test('Cached RETAIL, server response without businessCategory: does not retain stale category', async () => {
      setAccessToken('valid-token');
      // Cached had SERVICES
      setCurrentUser({
        id: 'sp-1',
        email: 'sp@test.com',
        role: 'ORG_STAFF',
        orgType: 'RETAIL',
        businessCategory: 'SERVICES',
      });

      // Server returns RETAIL without businessCategory in JSON
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => JSON.parse('{"id":"sp-1","email":"sp@test.com","role":"ORG_STAFF","orgType":"RETAIL"}'),
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('ok');
      expect(result.user?.businessCategory).toBeUndefined();
      expect(getDashboardRouteForUser(result.user)).toBe('/retail');
      expect(getCurrentUser()?.businessCategory).toBeUndefined();
    });

    test('Cached ADMIN, server response with a different role: authoritative server role determines route', async () => {
      setAccessToken('valid-token');
      setCurrentUser({ id: 'u-demoted', email: 'demoted@test.com', role: 'ADMIN' });

      // Server returns role: STUDENT
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => JSON.parse('{"id":"u-demoted","email":"demoted@test.com","role":"STUDENT"}'),
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('ok');
      expect(result.user?.role).toBe('STUDENT');
      expect(getDashboardRouteForUser(result.user)).toBe('/student');
      expect(getCurrentUser()?.role).toBe('STUDENT');
    });

    test('Cached permissions, server response without permissions: stale permissions completely stripped', async () => {
      setAccessToken('valid-token');
      setCurrentUser({
        id: 'u-perm',
        email: 'perm@test.com',
        role: 'ORG_STAFF',
        orgType: 'RETAIL',
        permissions: ['PRODUCTS_WRITE', 'DISCOUNTS_MANAGE', 'SETTINGS_ADMIN'],
      });

      // Server returns user without permissions field
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => JSON.parse('{"id":"u-perm","email":"perm@test.com","role":"ORG_STAFF","orgType":"RETAIL"}'),
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('ok');
      expect(result.user?.permissions).toBeUndefined();
      expect(getCurrentUser()?.permissions).toBeUndefined();
    });

    test('Server response with a different user ID: rejects stale user data and resets session to new user', async () => {
      setAccessToken('valid-token');
      setCurrentUser({
        id: 'user-old',
        email: 'old@test.com',
        firstName: 'Old',
        lastName: 'User',
        role: 'ADMIN',
      });

      // Server returns different user ID
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => JSON.parse('{"id":"user-new","email":"new@test.com","role":"STUDENT"}'),
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('ok');
      expect(result.user?.id).toBe('user-new');
      expect(result.user?.email).toBe('new@test.com');
      expect(result.user?.role).toBe('STUDENT');
      expect(result.user?.firstName).toBeUndefined();
      expect(result.user?.lastName).toBeUndefined();
      expect(getCurrentUser()?.id).toBe('user-new');
    });

    test('Changed business category: cache updated from RETAIL to SERVICES, updates destination route', async () => {
      setAccessToken('valid-token');
      // Cached was RETAIL
      setCurrentUser({
        id: 'sp-1',
        email: 'sp@test.com',
        role: 'ORG_STAFF',
        orgType: 'RETAIL',
        businessCategory: 'RETAIL',
      });

      // Server returns SERVICES
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: 'sp-1',
            email: 'sp@test.com',
            role: 'ORG_STAFF',
            orgType: 'RETAIL',
            businessCategory: 'SERVICES',
          },
        }),
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('ok');
      expect(result.user?.businessCategory).toBe('SERVICES');
      expect(getDashboardRouteForUser(result.user)).toBe('/services');
      expect(getCurrentUser()?.businessCategory).toBe('SERVICES');
    });

    test('Network failure does NOT authorize based on cached user and returns retryable error', async () => {
      setAccessToken('valid-token');
      setCurrentUser({ id: 's-offline', email: 'off@test.com', role: 'STUDENT' });

      global.fetch = async () => {
        throw new Error('Failed to fetch');
      };

      const result = await restoreUserSession();
      expect(result.status).toBe('error');
      expect(result.user).toBeNull();
      expect(result.error).toContain('Unable to connect');
    });

    test('Network failure without cached user returns clean error', async () => {
      setAccessToken('valid-token');

      global.fetch = async () => {
        throw new Error('Failed to fetch');
      };

      const result = await restoreUserSession();
      expect(result.status).toBe('error');
      expect(result.error).toContain('Unable to connect');
    });

    test('Malformed/Invalid JSON from server returns clean error and does not authorize', async () => {
      setAccessToken('valid-token');
      setCurrentUser({ id: 's-cached', email: 'cached@test.com', role: 'STUDENT' });

      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('error');
      expect(result.user).toBeNull();
      expect(result.error).toContain('Unexpected token');
    });

    test('Server response missing user ID returns error and does not authorize', async () => {
      setAccessToken('valid-token');
      setCurrentUser({ id: 's-cached', email: 'cached@test.com', role: 'STUDENT' });

      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ role: 'STUDENT', email: 'noid@test.com' }),
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('error');
      expect(result.user).toBeNull();
      expect(result.error).toContain('Invalid user payload');
    });

    test('Server response missing user role returns error and does not authorize', async () => {
      setAccessToken('valid-token');
      setCurrentUser({ id: 's-cached', email: 'cached@test.com', role: 'STUDENT' });

      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ id: 'u-1', email: 'norole@test.com' }),
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('error');
      expect(result.user).toBeNull();
      expect(result.error).toContain('Invalid user payload');
    });

    test('Missing API configuration or empty endpoint failure returns clean error', async () => {
      setAccessToken('valid-token');
      setCurrentUser({ id: 's-missing', email: 'missing@test.com', role: 'STUDENT' });

      global.fetch = async (url: any) => {
        // If url is relative or invalid and unhandled by environment
        throw new TypeError(`Failed to parse URL from ${url}`);
      };

      const result = await restoreUserSession();
      expect(result.status).toBe('error');
      expect(result.user).toBeNull();
    });

    test('Timeout aborts request and returns timeout status', async () => {
      setAccessToken('valid-token');

      global.fetch = async (_url: any, options: any) => {
        return new Promise((_, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      };

      const result = await restoreUserSession({ timeoutMs: 50 });
      expect(result.status).toBe('timeout');
      expect(result.error).toContain('timed out');
    });

    test('setCurrentUser safely handles null and undefined without storing "undefined"', () => {
      setCurrentUser(null);
      expect(getCurrentUser()).toBeNull();
      setCurrentUser(undefined);
      expect(getCurrentUser()).toBeNull();
    });

    test('handleApiError identifies 304 as notmodified', async () => {
      const mockRes = { ok: false, status: 304 } as Response;
      const status = await handleApiError(mockRes);
      expect(status).toBe('notmodified');
    });

    test('Timeout covers both response arrival and response body stream reading', async () => {
      setAccessToken('valid-token');

      global.fetch = async (_url: any, options: any) => {
        return {
          ok: true,
          status: 200,
          json: async () => {
            return new Promise((_, reject) => {
              if (options?.signal) {
                options.signal.addEventListener('abort', () => {
                  const abortErr = new Error('Body parsing aborted');
                  abortErr.name = 'AbortError';
                  reject(abortErr);
                });
              }
            });
          },
        } as any;
      };

      const result = await restoreUserSession({ timeoutMs: 50 });
      expect(result.status).toBe('timeout');
      expect(result.user).toBeNull();
    });

    test('Stale cached organization context is overwritten by authoritative server response', async () => {
      setAccessToken('valid-token');
      // Stale cache claims user is a general retail store
      setCurrentUser({
        id: 'user-change-1',
        email: 'change@test.com',
        role: 'ORG_STAFF',
        orgType: 'RETAIL',
        businessCategory: 'RETAIL',
      });

      // Server returns updated real role: MECHANIC
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: 'user-change-1',
            email: 'change@test.com',
            role: 'ORG_STAFF',
            orgType: 'RETAIL',
            businessCategory: 'MECHANICS',
          },
        }),
      } as any);

      const result = await restoreUserSession();
      expect(result.status).toBe('ok');
      expect(result.user?.businessCategory).toBe('MECHANICS');
      expect(getDashboardRouteForUser(result.user)).toBe('/mechanics');
      expect(getCurrentUser()?.businessCategory).toBe('MECHANICS');
    });

    test('All 10 distinct roles route deterministically without ambiguity', () => {
      const testCases: Array<{ user: Partial<User>; expectedRoute: string }> = [
        { user: { role: 'STUDENT' }, expectedRoute: '/student' },
        { user: { role: 'ADMIN' }, expectedRoute: '/admin' },
        { user: { role: 'SUPER_ADMIN' }, expectedRoute: '/admin' },
        { user: { role: 'ORG_STAFF', orgType: 'PROVIDER' }, expectedRoute: '/accommodation' },
        { user: { role: 'ORG_STAFF', orgType: 'AGENCY' }, expectedRoute: '/accommodation' },
        { user: { role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'RETAIL' }, expectedRoute: '/retail' },
        { user: { role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'FOOD' }, expectedRoute: '/food' },
        { user: { role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'SERVICES' }, expectedRoute: '/services' },
        { user: { role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'MECHANICS' }, expectedRoute: '/mechanics' },
        { user: { role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'RENTALS' }, expectedRoute: '/rentals' },
      ];

      for (const tc of testCases) {
        expect(getDashboardRouteForUser(tc.user)).toBe(tc.expectedRoute);
      }
    });
  });
});
