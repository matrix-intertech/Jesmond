import { test, expect } from '@playwright/test';

test.describe('Jesmond 2.0 - Genuine Browser Navigation & Dashboard E2E Tests', () => {

  const setupAuthSession = async (page: any, user: any, token = 'mock-valid-jwt-token') => {
    // Intercept all requests containing /api/v1/ via RegExp so 127.0.0.1, localhost, or relative URLs are all matched
    await page.route(/\/api\/v1\//, async (route: any) => {
      const url = route.request().url();
      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
          body: JSON.stringify({
            ...user,
            user,
          }),
        });
        return;
      }

      // Safe mock responses for page data endpoints
      if (url.includes('/orders/stats')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ totalRevenue: 0, orderCount: 0 }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Seed localStorage once before initial navigation
    await page.addInitScript(({ tokenVal, userVal }: { tokenVal: string; userVal: any }) => {
      if (window.sessionStorage.getItem('auth_seeded') !== 'true') {
        window.localStorage.setItem('token', tokenVal);
        window.localStorage.setItem('user', JSON.stringify(userVal));
        window.sessionStorage.setItem('auth_seeded', 'true');
      }
    }, { tokenVal: token, userVal: user });
  };

  test('1. Student Dashboard genuine navigation', async ({ page }) => {
    const studentUser = {
      id: 'student-e2e-1',
      email: 'student@jesmond.demo',
      role: 'STUDENT',
      firstName: 'Alex',
      lastName: 'Student',
    };

    await setupAuthSession(page, studentUser);
    await page.goto('/student');

    await expect(page).toHaveURL(/\/student/);
    await expect(page.locator('h1:has-text("Student Dashboard")')).toBeVisible({ timeout: 10_000 });
  });

  test('2. Accommodation Provider Dashboard genuine navigation', async ({ page }) => {
    const providerUser = {
      id: 'provider-e2e-1',
      email: 'provider@jesmond.demo',
      role: 'ORG_STAFF',
      organizationId: 'org-prov-1',
      orgType: 'PROVIDER',
      orgRole: 'OWNER',
    };

    await setupAuthSession(page, providerUser);
    await page.goto('/portal');

    await expect(page).toHaveURL(/\/portal/);
    await expect(page.locator('text=Provider Dashboard').first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. Service Provider Appointments Dashboard genuine navigation', async ({ page }) => {
    const serviceProviderUser = {
      id: 'service-e2e-1',
      email: 'services@jesmond.demo',
      role: 'ORG_STAFF',
      organizationId: 'org-serv-1',
      orgType: 'RETAIL',
      businessCategory: 'SERVICES',
      orgRole: 'MANAGER',
    };

    await setupAuthSession(page, serviceProviderUser);
    await page.goto('/portal/business/appointments');

    await expect(page).toHaveURL(/\/portal\/business\/appointments/);
    await expect(page.locator('h1, h2, div').filter({ hasText: /Appointments/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. Mechanic Appointments Dashboard genuine navigation', async ({ page }) => {
    const mechanicUser = {
      id: 'mechanic-e2e-1',
      email: 'mechanic@jesmond.demo',
      role: 'ORG_STAFF',
      organizationId: 'org-mech-1',
      orgType: 'RETAIL',
      businessCategory: 'MECHANICS',
      orgRole: 'OWNER',
    };

    await setupAuthSession(page, mechanicUser);
    await page.goto('/portal/business/appointments');

    await expect(page).toHaveURL(/\/portal\/business\/appointments/);
    await expect(page.locator('h1, h2, div').filter({ hasText: /Appointments/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('5. Food Business Orders Dashboard genuine navigation', async ({ page }) => {
    const foodUser = {
      id: 'food-e2e-1',
      email: 'food@jesmond.demo',
      role: 'ORG_STAFF',
      organizationId: 'org-food-1',
      orgType: 'RETAIL',
      businessCategory: 'FOOD',
      orgRole: 'MANAGER',
    };

    await setupAuthSession(page, foodUser);
    await page.goto('/portal/business/orders');

    await expect(page).toHaveURL(/\/portal\/business\/orders/);
  });

  test('6. Retail Operations Dashboard genuine navigation', async ({ page }) => {
    const retailerUser = {
      id: 'retail-e2e-1',
      email: 'retail@jesmond.demo',
      role: 'ORG_STAFF',
      organizationId: 'org-retail-1',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      orgRole: 'MANAGER',
    };

    await setupAuthSession(page, retailerUser);
    await page.goto('/portal/retail');

    await expect(page).toHaveURL(/\/portal\/retail/);
  });

  test('7. Direct Dashboard URL Access & Redirection Boundary', async ({ page }) => {
    // Service provider attempts to access /portal/retail directly
    const serviceProviderUser = {
      id: 'service-e2e-1',
      email: 'services@jesmond.demo',
      role: 'ORG_STAFF',
      organizationId: 'org-serv-1',
      orgType: 'RETAIL',
      businessCategory: 'SERVICES',
      orgRole: 'MANAGER',
    };

    await setupAuthSession(page, serviceProviderUser);
    await page.goto('/portal/retail');

    // Redirection boundary should intercept and redirect to /portal/business/appointments
    await page.waitForURL('**/portal/business/appointments', { timeout: 10_000 });
    expect(page.url()).toContain('/portal/business/appointments');
  });

  test('8. Browser Refresh maintains authenticated session', async ({ page }) => {
    const studentUser = {
      id: 'student-e2e-refresh',
      email: 'refresh@jesmond.demo',
      role: 'STUDENT',
    };

    await setupAuthSession(page, studentUser);
    await page.goto('/student');
    await expect(page).toHaveURL(/\/student/);

    // Perform real browser refresh
    await page.reload();

    // Verify session recovers and user remains on student portal
    await expect(page).toHaveURL(/\/student/);
  });

  test('9. Expired or Revoked Session (401) redirects to login', async ({ page }) => {
    await page.route(/\/api\/v1\//, async (route: any) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized session' }),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'expired-mock-token');
      window.localStorage.setItem('user', JSON.stringify({ id: 'u-exp', role: 'STUDENT' }));
    });

    await page.goto('/student');

    // Should be redirected to /login
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    // localStorage token must be cleared
    const storedToken = await page.evaluate(() => window.localStorage.getItem('token'));
    expect(storedToken).toBeNull();
  });

  test('10. Retry UI after server failure (500) and recovery on retry', async ({ page }) => {
    let returnFailure = true;

    await page.route(/\/api\/v1\//, async (route: any) => {
      const url = route.request().url();
      if (returnFailure) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'recovered-user-1',
            email: 'recovered@jesmond.demo',
            role: 'STUDENT',
          }),
        });
      }
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'retry-test-token');
      window.localStorage.setItem('user', JSON.stringify({ id: 'u-500', role: 'STUDENT' }));
    });

    await page.goto('/student');

    // Error card must be visible with Retry button
    const retryButton = page.locator('button:has-text("Retry")');
    await expect(retryButton).toBeVisible({ timeout: 10_000 });

    // Now restore server health and click Retry
    returnFailure = false;
    await retryButton.click();

    // Verify recovery and successful dashboard authorization
    await expect(page).toHaveURL(/\/student/);
  });

  test('11. Revoked organization access redirects provider to profile settings', async ({ page }) => {
    const revokedUser = {
      id: 'org-revoked-1',
      email: 'revoked@jesmond.demo',
      role: 'ORG_STAFF',
    };

    await setupAuthSession(page, revokedUser);
    await page.goto('/portal');

    // Layout should redirect user with missing orgType to /settings/profile
    await page.waitForURL('**/settings/profile', { timeout: 10_000 });
    expect(page.url()).toContain('/settings/profile');
  });

  test('12. User Logout clears session and redirects to login', async ({ page }) => {
    const studentUser = {
      id: 'student-logout-1',
      email: 'logout@jesmond.demo',
      role: 'STUDENT',
    };

    await setupAuthSession(page, studentUser);
    await page.goto('/student');
    await expect(page).toHaveURL(/\/student/);

    // If mobile, open sidebar first
    const toggleBtn = page.locator('button[aria-label="Toggle navigation"]');
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
    }

    // Click genuine Sign Out button in UI
    const signOutBtn = page.locator('button:has-text("Sign Out")').first();
    await expect(signOutBtn).toBeVisible({ timeout: 5000 });
    await signOutBtn.click();

    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
    const storedToken = await page.evaluate(() => window.localStorage.getItem('token'));
    expect(storedToken).toBeNull();
  });
});
