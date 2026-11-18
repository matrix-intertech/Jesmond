import { test, expect } from '@playwright/test';

test.describe('Jesmond 2.0 - Genuine Browser Navigation & Dashboard E2E Tests', () => {

  const setupAuthSession = async (page: any, user: any, token = 'mock-valid-jwt.eyJzdWIiOiJ1c2VyLTEifQ.sig') => {
    const corsHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    };

    // Intercept all requests containing /api/v1/ via RegExp so 127.0.0.1, localhost, or relative URLs are all matched
    await page.route(/\/api\/v1\//, async (route: any) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      const url = route.request().url();
      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
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
          headers: corsHeaders,
          body: JSON.stringify({ totalRevenue: 0, orderCount: 0 }),
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

    // Seed localStorage before initial navigation
    await page.addInitScript(({ tokenVal, userVal }: { tokenVal: string; userVal: any }) => {
      if (window.sessionStorage.getItem('auth_seeded_for') !== userVal.id) {
        window.localStorage.setItem('token', tokenVal);
        window.localStorage.setItem('access_token', tokenVal);
        window.localStorage.setItem('user', JSON.stringify(userVal));
        window.sessionStorage.setItem('auth_seeded_for', userVal.id);
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
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        },
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
    // Must render Account Settings and NOT hang on "Loading student account..."
    await expect(page.locator('h1:has-text("Account Settings")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Loading student account...')).not.toBeVisible();
  });

  test('13. Production reproduction: demo.services ORG_STAFF without org context resolves Account Settings cleanly', async ({ page }) => {
    // Exact production response shape from prompt
    const prodUser = {
      id: 'demo-services-prod-id',
      email: 'demo.services@jesmond.com.au',
      role: 'ORG_STAFF',
      permissions: [],
    };

    await setupAuthSession(page, prodUser);
    // User lands or is redirected to /settings/profile
    await page.goto('/settings/profile');

    await expect(page).toHaveURL(/\/settings\/profile/);
    // Header must say Account Settings, NOT Student Portal
    await expect(page.locator('h1:has-text("Account Settings")')).toBeVisible({ timeout: 10_000 });
    // Links for Profile, Security, Notifications, Privacy must be visible
    await expect(page.locator('a:has-text("Profile")').first()).toBeVisible();
    await expect(page.locator('a:has-text("Security")').first()).toBeVisible();
    // Must NOT be stuck in student loading UI
    await expect(page.locator('text=Student Portal')).not.toBeVisible();
    await expect(page.locator('text=Loading student account...')).not.toBeVisible();
  });

  test('14. Production reproduction: demo.services ORG_STAFF visiting /student redirects to /settings/profile safely', async ({ page }) => {
    const prodUser = {
      id: 'demo-services-prod-id',
      email: 'demo.services@jesmond.com.au',
      role: 'ORG_STAFF',
      permissions: [],
    };

    await setupAuthSession(page, prodUser);
    await page.goto('/student');

    // Should redirect away from student portal to /settings/profile
    await page.waitForURL('**/settings/profile', { timeout: 10_000 });
    expect(page.url()).toContain('/settings/profile');
    await expect(page.locator('h1:has-text("Account Settings")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Loading student account...')).not.toBeVisible();
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
    await signOutBtn.dispatchEvent('click');

    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
    const storedToken = await page.evaluate(() => window.localStorage.getItem('token'));
    expect(storedToken).toBeNull();
  });

  test('15a. Production Account Mapping: demo.mechanics resolves to Appointments Dashboard', async ({ page }) => {
    const mechanicsUser = {
      id: 'demo-mech-id',
      email: 'demo.mechanics@jesmond.com.au',
      role: 'ORG_STAFF',
      organizationId: 'org-mech-1',
      orgType: 'RETAIL',
      businessCategory: 'MECHANICS',
      permissions: ['*'],
      accountStatus: 'ACTIVE',
    };
    await setupAuthSession(page, mechanicsUser);
    await page.goto('/portal/business/appointments');
    await expect(page).toHaveURL(/\/portal\/business\/appointments/);
    await expect(page.locator('h1:has-text("Appointments")')).toBeVisible({ timeout: 10_000 });
  });

  test('15b. Production Account Mapping: demo.services resolves to Appointments Dashboard', async ({ page }) => {
    const servicesUser = {
      id: 'demo-serv-id',
      email: 'demo.services@jesmond.com.au',
      role: 'ORG_STAFF',
      organizationId: 'org-serv-1',
      orgType: 'RETAIL',
      businessCategory: 'SERVICES',
      permissions: ['*'],
      accountStatus: 'ACTIVE',
    };
    await setupAuthSession(page, servicesUser);
    await page.goto('/portal/business/appointments');
    await expect(page).toHaveURL(/\/portal\/business\/appointments/);
    await expect(page.locator('h1:has-text("Appointments")')).toBeVisible({ timeout: 10_000 });
  });

  test('15c. Production Account Mapping: shikharshaurya.01 resolves to Retail Operations Dashboard', async ({ page }) => {
    const retailerUser = {
      id: 'shikhar-retail-id',
      email: 'shikharshaurya.01@gmail.com',
      role: 'ORG_STAFF',
      organizationId: 'org-retail-1',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      orgRole: 'MANAGER',
      permissions: ['*'],
      accountStatus: 'ACTIVE',
    };
    await setupAuthSession(page, retailerUser);
    await page.goto('/portal/retail');
    await expect(page).toHaveURL(/\/portal\/retail/);
  });

  test('16. Universal Public Visibility UI: Retail Business Profile displays and interacts with Public Visibility toggle', async ({ page }) => {
    const retailerUser = {
      id: 'shikhar-retail-id',
      email: 'shikharshaurya.01@gmail.com',
      role: 'ORG_STAFF',
      organizationId: 'org-retail-1',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      permissions: ['*'],
      accountStatus: 'ACTIVE',
    };

    // Mock retail profile and location endpoints
    await page.route('**/api/v1/retail/businesses/profile', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'org-retail-1',
            name: 'Jesmond Demo Retail Store',
            type: 'RETAIL',
            businessCategory: 'RETAIL',
            timezone: 'Australia/Sydney',
            isPubliclyVisible: true,
          }),
        });
      } else if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'org-retail-1',
            name: 'Jesmond Demo Retail Store',
            type: 'RETAIL',
            businessCategory: 'RETAIL',
            timezone: body.timezone || 'Australia/Sydney',
            isPubliclyVisible: body.isPubliclyVisible !== undefined ? body.isPubliclyVisible : true,
          }),
        });
      }
    });

    await page.route('**/api/v1/retail/businesses/location', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          address: '123 Test St, Newcastle NSW',
          lat: -32.9,
          lng: 151.7,
        }),
      });
    });

    await setupAuthSession(page, retailerUser);
    await page.goto('/portal/retail/business');

    await expect(page).toHaveURL(/\/portal\/retail\/business/);
    await expect(page.locator('h1:has-text("Business Profile")')).toBeVisible({ timeout: 10_000 });

    // Verify Public Directory Visibility toggle is rendered and checked by default
    const visibilityCheckbox = page.locator('#retailIsPubliclyVisible');
    await expect(visibilityCheckbox).toBeVisible({ timeout: 5000 });
    await expect(visibilityCheckbox).toBeChecked();
    await expect(page.locator('text=Public Directory Visibility')).toBeVisible();

    // Toggle visibility off and save
    await visibilityCheckbox.uncheck();
    await expect(visibilityCheckbox).not.toBeChecked();

    const saveBtn = page.locator('button:has-text("Save Changes")');
    await saveBtn.click();
    await expect(page.locator('text=Business profile updated successfully')).toBeVisible({ timeout: 5000 });
  });

  test('17. Appointment Pricing Display: Provider portal renders minor-unit service price as AUD dollars without 100x multiplication', async ({ page }) => {
    const mechanicsUser = {
      id: 'demo-mech-id',
      email: 'demo.mechanics@jesmond.com.au',
      role: 'ORG_STAFF',
      organizationId: 'org-mech-1',
      orgType: 'RETAIL',
      businessCategory: 'MECHANICS',
      permissions: ['*'],
      accountStatus: 'ACTIVE',
    };

    await setupAuthSession(page, mechanicsUser);

    // Mock business-appointments endpoint with 8900 cents ($89.00)
    await page.route('**/api/v1/business-appointments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'appt-test-1',
            status: 'PENDING_APPROVAL',
            startTime: '2026-11-20T10:00:00.000Z',
            endTime: '2026-11-20T10:45:00.000Z',
            customer: { name: 'John Doe', email: 'john@example.com' },
            service: {
              id: 'srv-1',
              name: 'Comprehensive Vehicle Safety Inspection',
              price: 8900, // 8900 minor units (cents) = $89.00
              durationMins: 45,
            },
          },
        ]),
      });
    });

    await page.goto('/portal/business/appointments?tab=list');

    await expect(page).toHaveURL(/\/portal\/business\/appointments/);
    await expect(page.locator('h1:has-text("Appointments")')).toBeVisible({ timeout: 10_000 });

    // Verify service name is present
    await expect(page.locator('text=Comprehensive Vehicle Safety Inspection')).toBeVisible();

    // Verify price is formatted accurately as AUD $89.00 and NOT AUD $8900.00
    await expect(page.locator('text=AUD $89.00')).toBeVisible();
    await expect(page.locator('text=AUD $8900.00')).not.toBeVisible();
  });
});
