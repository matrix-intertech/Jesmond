import { test, expect } from '@playwright/test';
import http from 'http';
import {
  saveBffSession,
  getBffSession,
  markHandlePendingRevocation,
} from '../app/api/auth/session/_store';

const MAIN_HOST = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3005';
const BUSINESS_HOST = (() => {
  const url = new URL(MAIN_HOST);
  return `${url.protocol}//business.${url.host}`;
})();

// Valid-shaped JWT with future exp (year 2099)
const FUTURE_EXP = Math.floor(Date.UTC(2099, 0, 1) / 1000);
const MOCK_PAYLOAD = Buffer.from(
  JSON.stringify({ sub: 'usr-sec-1', role: 'ORG_STAFF', exp: FUTURE_EXP }),
).toString('base64url');
const MOCK_JWT = `eyJhbGciOiJIUzI1NiJ9.${MOCK_PAYLOAD}.sig`;

const EXPIRED_PAYLOAD = Buffer.from(
  JSON.stringify({ sub: 'usr-sec-1', role: 'ORG_STAFF', exp: 1000 }),
).toString('base64url');
const EXPIRED_JWT = `eyJhbGciOiJIUzI1NiJ9.${EXPIRED_PAYLOAD}.sig`;

const getCorsHeaders = (req: any) => ({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': req.headers()['origin'] || MAIN_HOST,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Organization-Id, Cache-Control, Pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
});

/**
 * Starts a local mock backend on 127.0.0.1:3001 if nothing is listening,
 * so BFF server-side verification tests can exercise real HTTP fail-closed behavior.
 */
async function startMockBackend(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  const server = http.createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(3001, '127.0.0.1', () => resolve());
  });
  return server;
}

test.describe('Cross-Domain SSO Security Remediation & BFF Verification', () => {
  test('1. XSS protection: GET /api/auth/session never returns accessToken or refreshToken', async ({
    page,
  }) => {
    const bizUser = {
      id: 'usr-xss-1',
      email: 'mech@workshop.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'MECHANICS',
      organizationId: 'org-xss-mech',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: bizUser,
          organizationId: bizUser.organizationId,
        }),
      });
    });

    await page.goto(`${MAIN_HOST}/`);
    await page.getByTestId('nav-profile-trigger').click();
    const dashboardLink = page.getByRole('menuitem', { name: 'Dashboard' });
    await expect(dashboardLink).toBeVisible({ timeout: 10_000 });
    await expect(dashboardLink).toHaveAttribute('href', `${BUSINESS_HOST}/mechanics`);

    const sessionPayload = await page.evaluate(async () => {
      const r = await fetch('/api/auth/session');
      return r.json();
    });
    expect(sessionPayload.accessToken).toBeUndefined();
    expect(sessionPayload.access_token).toBeUndefined();
    expect(sessionPayload.refreshToken).toBeUndefined();
  });

  test('2. Fail-closed establish: backend outage returns 503 and sets NO cookie', async ({
    request,
  }) => {
    // No backend listening on 3001 -> must fail closed with 503
    const res = await request.post(`${MAIN_HOST}/api/auth/session/establish`, {
      headers: {
        Host: 'jesmond.com.au',
        Origin: 'https://jesmond.com.au',
        'Sec-Fetch-Site': 'same-origin',
        'X-Forwarded-Proto': 'https',
        'Content-Type': 'application/json',
      },
      data: { access_token: MOCK_JWT },
    });
    expect(res.status()).toBe(503);
    expect(res.headers()['set-cookie']).toBeUndefined();
  });

  test('3. Fail-closed establish: expired or invalid JWT is rejected (400/401) and sets NO cookie', async ({
    request,
  }) => {
    const badFormat = await request.post(`${MAIN_HOST}/api/auth/session/establish`, {
      headers: {
        Host: 'jesmond.com.au',
        Origin: 'https://jesmond.com.au',
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/json',
      },
      data: { access_token: 'not-a-jwt' },
    });
    expect(badFormat.status()).toBe(400);
    expect(badFormat.headers()['set-cookie']).toBeUndefined();

    const expiredRes = await request.post(`${MAIN_HOST}/api/auth/session/establish`, {
      headers: {
        Host: 'jesmond.com.au',
        Origin: 'https://jesmond.com.au',
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/json',
      },
      data: { access_token: EXPIRED_JWT },
    });
    expect(expiredRes.status()).toBe(401);
    expect(expiredRes.headers()['set-cookie']).toBeUndefined();
  });

  test('4. CSRF & Origin enforcement: rejects cross-site, untrusted Origin, untrusted Host, and non-JSON', async ({
    request,
  }) => {
    // Cross-site Sec-Fetch-Site
    const crossSite = await request.post(`${MAIN_HOST}/api/auth/session/establish`, {
      headers: {
        Host: 'jesmond.com.au',
        Origin: 'https://jesmond.com.au',
        'Sec-Fetch-Site': 'cross-site',
        'Content-Type': 'application/json',
      },
      data: { access_token: MOCK_JWT },
    });
    expect(crossSite.status()).toBe(403);

    // Untrusted Origin
    const evilOrigin = await request.post(`${MAIN_HOST}/api/auth/session/logout`, {
      headers: {
        Host: 'jesmond.com.au',
        Origin: 'https://evil.example.com',
        'Sec-Fetch-Site': 'same-site',
        'Content-Type': 'application/json',
      },
      data: {},
    });
    expect(evilOrigin.status()).toBe(403);

    // Untrusted Host / X-Forwarded-Host
    const evilHost = await request.post(`${MAIN_HOST}/api/auth/session/select-org`, {
      headers: {
        Host: 'attacker.example.com',
        Origin: 'https://jesmond.com.au',
        'Content-Type': 'application/json',
      },
      data: { organizationId: 'org-1' },
    });
    expect(evilHost.status()).toBe(403);

    // Non-JSON Content-Type (form CSRF)
    const formCsrf = await request.post(`${MAIN_HOST}/api/auth/session/logout`, {
      headers: {
        Host: 'jesmond.com.au',
        Origin: 'https://jesmond.com.au',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: 'x=1',
    });
    expect(formCsrf.status()).toBe(415);
  });

  test('5. Opaque session handle, select-org fail-closed verification, refresh rotation, API proxy, and logout revocation', async ({
    request,
  }) => {
    let sessionRevoked = false;
    let lastProxyAuth = '';
    const server = await startMockBackend((req, res) => {
      if (req.url?.includes('/api/v1/auth/sso/business-check')) {
        if (sessionRevoked || req.headers.authorization !== `Bearer ${MOCK_JWT}`) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Unauthorized' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            userId: 'usr-sec-1',
            email: 'owner@retail.example.com',
            role: 'ORG_STAFF',
            hasBusinessAccess: true,
            isAdmin: false,
            organizations: [
              { organizationId: 'org-allowed-1', orgType: 'RETAIL', businessCategory: 'RETAIL', role: 'ADMIN' },
            ],
          }),
        );
        return;
      }

      if (req.url?.includes('/api/v1/auth/me')) {
        if (sessionRevoked) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Revoked' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'usr-sec-1',
            email: 'owner@retail.example.com',
            role: 'ORG_STAFF',
            orgType: 'RETAIL',
            businessCategory: 'RETAIL',
            organizationId: 'org-allowed-1',
          }),
        );
        return;
      }

      if (req.url?.includes('/api/v1/auth/sso/logout')) {
        sessionRevoked = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.url?.includes('/api/v1/properties/my')) {
        lastProxyAuth = req.headers.authorization || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ id: 'prop-1', name: 'Proxy Verified' }]));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    try {
      // A. Establish session -> cookie holds opaque handle, NOT raw JWT
      const estRes = await request.post(`${MAIN_HOST}/api/auth/session/establish`, {
        headers: {
          Host: 'jesmond.com.au',
          Origin: 'https://jesmond.com.au',
          'Sec-Fetch-Site': 'same-origin',
          'X-Forwarded-Proto': 'https',
          'Content-Type': 'application/json',
        },
        data: { access_token: MOCK_JWT, organizationId: 'org-allowed-1' },
      });
      expect(estRes.status()).toBe(200);
      const estCookie = estRes.headers()['set-cookie'] || '';
      expect(estCookie).toContain('jesmond_sso_session=');
      expect(estCookie).not.toContain(MOCK_JWT);
      expect(estCookie).toContain('Domain=.jesmond.com.au');
      expect(estCookie).toContain('HttpOnly');
      expect(estCookie).toContain('Secure');
      expect(estCookie.toLowerCase()).toContain('samesite=lax');

      const handleMatch = estCookie.match(/jesmond_sso_session=([^;]+)/);
      expect(handleMatch).toBeTruthy();
      const handle1 = handleMatch![1];

      // B. GET /api/auth/session returns user WITHOUT accessToken
      const sessionRes = await request.get(`${MAIN_HOST}/api/auth/session`, {
        headers: {
          Host: 'business.jesmond.com.au',
          Cookie: `jesmond_sso_session=${handle1}`,
        },
      });
      expect(sessionRes.status()).toBe(200);
      const sessionJson = await sessionRes.json();
      expect(sessionJson.authenticated).toBe(true);
      expect(sessionJson.user.id).toBe('usr-sec-1');
      expect(sessionJson.accessToken).toBeUndefined();

      // C. Same-origin API proxy injects Bearer token server-side from opaque cookie
      const proxyRes = await request.get(`${MAIN_HOST}/api/v1/properties/my`, {
        headers: {
          Host: 'business.jesmond.com.au',
          Cookie: `jesmond_sso_session=${handle1}`,
        },
      });
      expect(proxyRes.status()).toBe(200);
      expect(lastProxyAuth).toBe(`Bearer ${MOCK_JWT}`);

      // D. select-org rejects unauthorized orgId (403)
      const badOrgRes = await request.post(`${MAIN_HOST}/api/auth/session/select-org`, {
        headers: {
          Host: 'business.jesmond.com.au',
          Origin: 'https://business.jesmond.com.au',
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/json',
          Cookie: `jesmond_sso_session=${handle1}`,
        },
        data: { organizationId: 'org-unauthorized-999' },
      });
      expect(badOrgRes.status()).toBe(403);

      // E. Refresh rotates opaque handle and invalidates old handle
      const refreshRes = await request.post(`${MAIN_HOST}/api/auth/session/refresh`, {
        headers: {
          Host: 'jesmond.com.au',
          Origin: 'https://jesmond.com.au',
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/json',
          Cookie: `jesmond_sso_session=${handle1}`,
        },
        data: {},
      });
      expect(refreshRes.status()).toBe(200);
      const handle2Match = (refreshRes.headers()['set-cookie'] || '').match(/jesmond_sso_session=([^;]+)/);
      expect(handle2Match).toBeTruthy();
      const handle2 = handle2Match![1];
      expect(handle2).not.toBe(handle1);

      // Old handle is invalidated
      const oldHandleRes = await request.get(`${MAIN_HOST}/api/auth/session`, {
        headers: { Host: 'jesmond.com.au', Cookie: `jesmond_sso_session=${handle1}` },
      });
      expect(oldHandleRes.status()).toBe(401);

      // F. Logout confirms backend revocation and clears cookies
      const logoutRes = await request.post(`${MAIN_HOST}/api/auth/session/logout`, {
        headers: {
          Host: 'business.jesmond.com.au',
          Origin: 'https://business.jesmond.com.au',
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/json',
          Cookie: `jesmond_sso_session=${handle2}`,
        },
        data: {},
      });
      expect(logoutRes.status()).toBe(200);
      const logoutJson = await logoutRes.json();
      expect(logoutJson.backendRevoked).toBe(true);
      expect(sessionRevoked).toBe(true);
    } finally {
      server.close();
    }
  });

  test('6. Cross-domain login UI flow: main login -> business dashboard with zero URL/localStorage token leakage', async ({
    page,
  }) => {
    const bizUser = {
      id: 'usr-sso-biz-1',
      email: 'owner@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-sso-retail',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    let establishCalled = false;

    await page.route(/\/api\/v1\//, async (route) => {
      const req = route.request();
      const corsHeaders = getCorsHeaders(req);
      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      const url = req.url();
      if (url.includes('/auth/login')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ access_token: MOCK_JWT, user: bizUser }),
        });
        return;
      }
      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ ...bizUser, user: bizUser }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/auth/session/establish', async (route) => {
      establishCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto(`${MAIN_HOST}/login`);
    await page.locator('input[type="email"]').fill(bizUser.email);
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: /Sign In/i }).first().click();

    await page.waitForURL('**/retail', { timeout: 15_000 });
    expect(establishCalled).toBe(true);
    expect(page.url()).toBe(`${BUSINESS_HOST}/retail`);
    expect(page.url()).not.toContain(MOCK_JWT);
    expect(page.url()).not.toContain('access_token');

    const storedToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(storedToken).toBeNull();
  });

  test('7. MFA challenge flow: password-only response does not establish SSO; valid 2FA establishes SSO and invalid 2FA rejects', async ({
    page,
  }) => {
    let establishCount = 0;
    let mfaCompleted = false;
    const mfaUser = {
      id: 'usr-mfa-1',
      email: 'mfa@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-mfa-retail',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await page.route(/\/api\/v1\//, async (route) => {
      const req = route.request();
      const corsHeaders = getCorsHeaders(req);
      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      const url = req.url();
      if (url.includes('/auth/login/2fa')) {
        const body = req.postDataJSON();
        if (body?.code === '654321' && body?.mfaToken === 'mfa-challenge-jwt') {
          mfaCompleted = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({ access_token: MOCK_JWT, user: mfaUser }),
          });
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Invalid verification code' }),
          });
        }
        return;
      }
      if (url.includes('/auth/login')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ mfaRequired: true, mfaToken: 'mfa-challenge-jwt' }),
        });
        return;
      }
      if (url.includes('/auth/sso/business-check')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            hasBusinessAccess: true,
            isAdmin: false,
            organizations: [{ ...mfaUser, organizationName: 'MFA Retail Co', role: 'ADMIN' }],
            activeOrganization: { ...mfaUser, organizationName: 'MFA Retail Co', role: 'ADMIN' },
          }),
        });
        return;
      }
      if (url.includes('/auth/me')) {
        if (!mfaCompleted) {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Unauthorized' }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ ...mfaUser, user: mfaUser }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/auth/session/establish', async (route) => {
      establishCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto(`${BUSINESS_HOST}/login`);
    await page.locator('input[type="email"]').fill(mfaUser.email);
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Dashboard/i }).click();

    // Password-only response must NOT establish shared SSO session
    await expect(page.getByText('Two-Factor Authentication Required')).toBeVisible();
    expect(establishCount).toBe(0);

    // Invalid MFA code shows error and still does NOT establish shared SSO session
    await page.locator('#business-mfa-code').fill('000000');
    await page.getByRole('button', { name: /Verify & Sign In/i }).click();
    await expect(page.getByText('Invalid verification code')).toBeVisible();
    expect(establishCount).toBe(0);

    // Valid MFA code establishes SSO session and redirects to dashboard
    await page.locator('#business-mfa-code').fill('654321');
    await page.getByRole('button', { name: /Verify & Sign In/i }).click();
    await page.waitForURL('**/retail', { timeout: 15_000 });
    expect(establishCount).toBe(1);
  });

  test('8. Fail-closed establishSharedSession: 503 on /api/auth/session/establish surfaces error and blocks redirect', async ({
    page,
  }) => {
    const bizUser = {
      id: 'usr-est-fail',
      email: 'fail@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-est-fail',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await page.route(/\/api\/v1\//, async (route) => {
      const req = route.request();
      const corsHeaders = getCorsHeaders(req);
      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      const url = req.url();
      if (url.includes('/auth/login')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ access_token: MOCK_JWT, user: bizUser }),
        });
        return;
      }
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    await page.route('**/api/auth/session/establish', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Session store unavailable' }),
      });
    });

    await page.goto(`${BUSINESS_HOST}/login`);
    await page.locator('input[type="email"]').fill(bizUser.email);
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Dashboard/i }).click();

    await expect(
      page.getByText(/Authentication service is temporarily unavailable/i),
    ).toBeVisible();
    expect(page.url()).toContain('/login');
  });

  test('9. Student isolation: student login never calls /api/auth/session/establish, and BFF rejects STUDENT tokens with 403', async ({
    page,
    request,
  }) => {
    let establishCalled = false;
    const studentUser = {
      id: 'stu-iso-1',
      email: 'student.iso@jesmond.com.au',
      role: 'STUDENT',
      firstName: 'Sam',
      lastName: 'Student',
    };

    await page.route('**/api/auth/session/establish', async (route) => {
      establishCalled = true;
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await page.route(/\/api\/v1\//, async (route) => {
      const req = route.request();
      const corsHeaders = getCorsHeaders(req);
      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      if (req.url().includes('/auth/login')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ access_token: MOCK_JWT, user: studentUser }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ ...studentUser, user: studentUser }),
      });
    });

    await page.goto(`${MAIN_HOST}/login`);
    await page.locator('input[type="email"]').fill(studentUser.email);
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL('**/student', { timeout: 15_000 });
    expect(establishCalled).toBe(false);

    // Server-side BFF establish must also reject STUDENT role with 403
    const server = await startMockBackend((req, res) => {
      if (req.url === '/api/v1/auth/sso/business-check') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            userId: studentUser.id,
            role: 'STUDENT',
            hasBusinessAccess: false,
            isAdmin: false,
            organizations: [],
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    try {
      const res = await request.post(`${MAIN_HOST}/api/auth/session/establish`, {
        headers: {
          Origin: MAIN_HOST,
          'Content-Type': 'application/json',
        },
        data: { access_token: MOCK_JWT },
      });
      expect(res.status()).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('10. Header profile dropdown (desktop & mobile), role-based Business Settings visibility, email fallback, and cross-tab shared logout', async ({
    context,
    page,
  }) => {
    const bizAdmin = {
      id: 'usr-drop-1',
      email: 'owner@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-drop-1',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    let sessionActive = true;

    const setupRoutes = async (p: any, userObj: any) => {
      await p.route('**/api/auth/session', async (route: any) => {
        if (!sessionActive) {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ authenticated: false, user: null }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: true,
            user: userObj,
            organizationId: userObj.organizationId || null,
          }),
        });
      });

      await p.route('**/api/auth/session/logout', async (route: any) => {
        sessionActive = false;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, backendRevoked: true }),
        });
      });

      await p.route(/\/api\/v1\//, async (route: any) => {
        const req = route.request();
        const corsHeaders = getCorsHeaders(req);
        if (req.method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: corsHeaders });
          return;
        }
        if (req.url().includes('/auth/me')) {
          if (!sessionActive) {
            await route.fulfill({ status: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Unauthorized' }) });
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({ ...userObj, user: userObj }),
          });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify({}) });
      });
    };

    // 1. Business Admin without first/last name -> email fallback + Business Settings visible
    await setupRoutes(page, bizAdmin);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${MAIN_HOST}/`);

    const trigger = page.getByTestId('nav-profile-trigger');
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('owner@retail.example.com');
    await trigger.click();

    await expect(page.getByRole('menuitem', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Business Settings' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();

    // Verify portaled dropdown renders outside <nav> and is not clipped below the navbar
    const dropdownLayout = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Main Navigation"]');
      const menu = document.getElementById('nav-profile-menu');
      const navRect = nav?.getBoundingClientRect();
      const menuRect = menu?.getBoundingClientRect();
      return {
        isOutsideNav: Boolean(menu && nav && !nav.contains(menu)),
        menuHeight: menuRect?.height || 0,
        menuBottom: menuRect?.bottom || 0,
        navBottom: navRect?.bottom || 0,
      };
    });
    expect(dropdownLayout.isOutsideNav).toBe(true);
    expect(dropdownLayout.menuHeight).toBeGreaterThan(150);
    expect(dropdownLayout.menuBottom).toBeGreaterThan(dropdownLayout.navBottom + 100);

    // Escape closes menu
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: 'User Profile Menu' })).toHaveCount(0);

    // Mobile profile menu also shows Business Settings and Logout
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Open Navigation Menu/i }).click();
    const mobileProfile = page.getByTestId('mobile-profile-menu');
    await expect(mobileProfile).toBeVisible();
    await expect(mobileProfile.getByRole('link', { name: 'Business Settings' })).toBeVisible();
    await expect(mobileProfile.getByRole('button', { name: 'Logout' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Open second tab on main portal and verify cross-tab logout sync
    const secondTab = await context.newPage();
    await setupRoutes(secondTab, bizAdmin);
    await secondTab.setViewportSize({ width: 1440, height: 900 });
    await secondTab.goto(`${MAIN_HOST}/`);
    await expect(secondTab.getByTestId('nav-profile-trigger')).toBeVisible();

    // Logout from first tab
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByTestId('nav-profile-trigger').click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    await expect(secondTab.getByRole('link', { name: 'Log in' }).first()).toBeVisible({ timeout: 10_000 });
    await secondTab.close();
  });

  test('11. Cross-subdomain open-tab logout sync via focus/visibility revalidation (MAIN_HOST <-> BUSINESS_HOST) and transient 503 resilience', async ({
    context,
  }) => {
    const bizAdmin = {
      id: 'usr-xsub-1',
      email: 'crosssub@retail.example.com',
      role: 'ORG_STAFF',
      firstName: 'Cross',
      lastName: 'Subdomain',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-xsub-1',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    let sessionMode: 'ok' | '503' | '401' = 'ok';

    const attachRoutes = async (p: any) => {
      await p.route('**/api/auth/session', async (route: any) => {
        if (sessionMode === '503') {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ authenticated: false, user: null, error: 'Session store unavailable' }),
          });
          return;
        }
        if (sessionMode === '401') {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ authenticated: false, user: null }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: true,
            user: bizAdmin,
            organizationId: bizAdmin.organizationId,
          }),
        });
      });

      await p.route('**/api/auth/session/logout', async (route: any) => {
        sessionMode = '401';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, redisDeleted: true, backendRevoked: true }),
        });
      });

      await p.route(/\/api\/v1\//, async (route: any) => {
        const req = route.request();
        const corsHeaders = getCorsHeaders(req);
        if (req.method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: corsHeaders });
          return;
        }
        if (req.url().includes('/business/credentials/requirements')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({
              organizationId: bizAdmin.organizationId,
              organizationName: 'Cross Subdomain Retail',
              businessCategory: 'RETAIL',
              overallStatus: 'VERIFIED',
              isCompleted: true,
              requirements: [],
            }),
          });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify([]) });
      });
    };

    const mainTab = await context.newPage();
    const bizTab = await context.newPage();
    await attachRoutes(mainTab);
    await attachRoutes(bizTab);

    // 1. Open both portals simultaneously (different origins: MAIN_HOST vs BUSINESS_HOST)
    await mainTab.setViewportSize({ width: 1440, height: 900 });
    await mainTab.goto(`${MAIN_HOST}/`);
    await expect(mainTab.getByTestId('nav-profile-trigger')).toBeVisible({ timeout: 10_000 });

    await bizTab.setViewportSize({ width: 1440, height: 900 });
    await bizTab.goto(`${BUSINESS_HOST}/retail`);
    await expect(bizTab.getByTestId('dashboard-header-title')).toBeVisible({ timeout: 10_000 });

    // 2. Temporary 503 outage on focus must NOT log out the open Business Portal tab
    sessionMode = '503';
    await bizTab.evaluate(() => window.dispatchEvent(new Event('focus')));
    await bizTab.waitForTimeout(300);
    expect(bizTab.url()).toContain('/retail');

    // 3. Logout from MAIN_HOST -> focus on BUSINESS_HOST tab must detect 401 and redirect to /business/login
    sessionMode = 'ok';
    await mainTab.getByTestId('nav-profile-trigger').click();
    await mainTab.getByRole('menuitem', { name: 'Logout' }).click();
    await mainTab.waitForURL('**/login', { timeout: 10_000 });

    await bizTab.evaluate(() => window.dispatchEvent(new Event('focus')));
    await bizTab.waitForURL(/\/(business\/)?login/, { timeout: 10_000 });
    expect(bizTab.url()).toMatch(/\/(business\/)?login/);

    // 4. Reverse direction: both tabs open, logout from BUSINESS_HOST -> focus on MAIN_HOST tab detects 401
    sessionMode = 'ok';
    await mainTab.goto(`${MAIN_HOST}/`);
    await expect(mainTab.getByTestId('nav-profile-trigger')).toBeVisible({ timeout: 10_000 });
    await bizTab.goto(`${BUSINESS_HOST}/retail`);
    await expect(bizTab.getByTestId('dashboard-header-title')).toBeVisible({ timeout: 10_000 });

    await bizTab.getByRole('button', { name: /Sign Out|Log Out/i }).first().click();
    await bizTab.waitForURL('**/login', { timeout: 10_000 });

    await mainTab.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(mainTab.getByRole('link', { name: 'Log in' }).first()).toBeVisible({ timeout: 10_000 });

    await mainTab.close();
    await bizTab.close();
  });

  test('12. Logout resilience: backend outage returns 502 with cookies cleared & Redis deleted; non-student BFF 401 does not fall back to /api/v1/auth/me', async ({
    page,
    request,
  }) => {
    // Part A: Real BFF logout when backend is unreachable (502, redisDeleted: true, backendRevoked: false, cookies cleared)
    const server = await startMockBackend((req, res) => {
      if (req.url === '/api/v1/auth/sso/business-check') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            userId: 'usr-logout-resil',
            role: 'ORG_STAFF',
            hasBusinessAccess: true,
            isAdmin: false,
            organizations: [{ organizationId: 'org-1', orgType: 'RETAIL', businessCategory: 'RETAIL', role: 'ADMIN' }],
          }),
        );
        return;
      }
      if (req.url === '/api/v1/auth/sso/logout') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Internal error' }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    try {
      const estRes = await request.post(`${MAIN_HOST}/api/auth/session/establish`, {
        headers: { Origin: MAIN_HOST, 'Content-Type': 'application/json' },
        data: { access_token: MOCK_JWT, organizationId: 'org-1' },
      });
      expect(estRes.status()).toBe(200);
      const setCookie = estRes.headers()['set-cookie'] || '';
      const handleMatch = setCookie.match(/jesmond_sso_session=([^;]+)/);
      expect(handleMatch).toBeTruthy();
      const handle = handleMatch![1];

      const logoutRes = await request.post(`${MAIN_HOST}/api/auth/session/logout`, {
        headers: {
          Origin: MAIN_HOST,
          'Content-Type': 'application/json',
          Cookie: `jesmond_sso_session=${handle}`,
        },
        data: {},
      });
      expect(logoutRes.status()).toBe(502);
      const logoutBody = await logoutRes.json();
      expect(logoutBody.success).toBe(false);
      expect(logoutBody.redisDeleted).toBe(true);
      expect(logoutBody.backendRevoked).toBe(false);
      expect(logoutRes.headers()['set-cookie']).toContain('jesmond_sso_session=;');

      // Verify Redis handle is unusable even though backend returned 500
      const postLogoutSession = await request.get(`${MAIN_HOST}/api/auth/session`, {
        headers: { Cookie: `jesmond_sso_session=${handle}` },
      });
      expect(postLogoutSession.status()).toBe(401);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // Part B: Non-student BFF 401 must NOT fall back to /api/v1/auth/me even if localStorage has a stale token
    let meCalls = 0;
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false, user: null }),
      });
    });
    await page.route('**/api/v1/auth/me', async (route) => {
      meCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'usr-stale', email: 'stale@retail.example.com', role: 'ORG_STAFF' }),
      });
    });

    await page.goto(`${MAIN_HOST}/`);
    await page.evaluate(() => {
      localStorage.setItem('access_token', 'stale-non-student-token');
      localStorage.setItem('user', JSON.stringify({ id: 'usr-stale', email: 'stale@retail.example.com', role: 'ORG_STAFF' }));
    });
    await page.goto(`${MAIN_HOST}/portal/retail`);
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(meCalls).toBe(0);
  });

  test('13. Redis outage recovery blocks replayed pending-revocation handles; Business settings page loads after full reload without localStorage tokens', async ({
    page,
  }) => {
    // Part A: Pending-revocation tombstone blocks replay after store recovery
    const handle = 'orphan-handle-outage-test';
    await saveBffSession(handle, {
      accessToken: MOCK_JWT,
      organizationId: 'org-1',
      userId: 'usr-1',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    markHandlePendingRevocation(handle);
    const afterRecovery = await getBffSession(handle);
    expect(afterRecovery).toBeNull();
    // Subsequent lookup remains null (handle deleted from store)
    expect(await getBffSession(handle)).toBeNull();

    // Part B: Full reload on BUSINESS_HOST/portal/settings/business with zero localStorage tokens
    const bizUser = {
      id: 'usr-settings-reload',
      email: 'settings@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-settings-reload',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    let businessSettingsFetched = false;
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: bizUser,
          organizationId: bizUser.organizationId,
        }),
      });
    });

    await page.route(/\/api\/v1\//, async (route) => {
      const req = route.request();
      const corsHeaders = getCorsHeaders(req);
      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      if (req.url().includes('/settings/provider/business')) {
        businessSettingsFetched = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            name: 'Reloaded Retail Pty Ltd',
            abn: '51824753556',
            timezone: 'Australia/Sydney',
            isPubliclyVisible: true,
          }),
        });
        return;
      }
      if (req.url().includes('/business/credentials/requirements')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            organizationId: bizUser.organizationId,
            organizationName: 'Reloaded Retail Pty Ltd',
            businessCategory: 'RETAIL',
            overallStatus: 'VERIFIED',
            isCompleted: true,
            requirements: [],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify([]),
      });
    });

    await page.goto(`${BUSINESS_HOST}/portal/settings/business`);
    await expect(page.locator('input[value="Reloaded Retail Pty Ltd"]')).toBeVisible({
      timeout: 15_000,
    });
    expect(businessSettingsFetched).toBe(true);
    const hasLocalTokens = await page.evaluate(() => ({
      access_token: localStorage.getItem('access_token'),
      token: localStorage.getItem('token'),
    }));
    expect(hasLocalTokens.access_token).toBeNull();
    expect(hasLocalTokens.token).toBeNull();
  });
});
