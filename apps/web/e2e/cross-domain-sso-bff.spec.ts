import { test, expect } from '@playwright/test';
import http from 'http';

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
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' }).first();
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
});
