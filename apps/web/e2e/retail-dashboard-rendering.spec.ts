import { test, expect } from '@playwright/test';

test.describe('Retail Business Dashboard Rendering & Property Host Isolation', () => {
  const setupAuthSession = async (page: any, user: any, token = 'mock-valid-jwt.eyJzdWIiOiJ1c2VyLTEifQ.sig') => {
    const corsHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    };

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

      if (url.includes('/retail/terminals')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify([{ id: 'term-1', name: 'Counter 1', status: 'ACTIVE' }]),
        });
        return;
      }

      if (url.includes('/retail/customers')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify([{ id: 'cust-1', name: 'John Doe' }]),
        });
        return;
      }

      if (url.includes('/retail/orders/stats')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ todayRevenue: 15450 }),
        });
        return;
      }

      if (url.includes('/retail/orders')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            data: [
              {
                id: 'ord-1',
                orderNumber: 'ORD-1001',
                total: 4500,
                status: 'COMPLETED',
                createdAt: new Date().toISOString(),
                fulfillmentType: 'IN_STORE',
              },
            ],
          }),
        });
        return;
      }

      if (url.includes('/retail/branches')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify([{ id: 'br-1', name: 'Main Branch' }]),
        });
        return;
      }

      if (url.includes('/retail/inventory')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify([{ id: 'inv-1', quantity: 2 }]),
        });
        return;
      }

      if (url.includes('/properties/my')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify([
            { id: 'prop-1', name: 'Mock Property', status: 'PUBLISHED' },
          ]),
        });
        return;
      }

      if (url.includes('/applications/provider')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify([]),
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

    await page.addInitScript(
      ({ tokenVal, userVal }: { tokenVal: string; userVal: any }) => {
        window.localStorage.setItem('token', tokenVal);
        window.localStorage.setItem('access_token', tokenVal);
        window.localStorage.setItem('user', JSON.stringify(userVal));
      },
      { tokenVal: token, userVal: user },
    );
  };

  test('1. Retail Business Account renders Retail Dashboard and does NOT render Property Host content', async ({
    page,
  }) => {
    const retailUser = {
      id: 'retail-usr-1',
      email: 'retailer@jesmond.demo',
      role: 'ORG_STAFF',
      organizationId: 'org-retail-1',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      orgRole: 'ADMIN',
      permissions: ['*'],
      accountStatus: 'ACTIVE',
    };

    await setupAuthSession(page, retailUser);
    await page.goto('/portal');

    // Should route to /portal/retail
    await expect(page).toHaveURL(/\/portal\/retail/);

    // Verify Header
    await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText(
      'Retail Business Dashboard',
    );

    // Verify Retail Dashboard Content is rendered in main
    const main = page.getByRole('main');
    await expect(main.getByText('Total Terminals')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Total Customers')).toBeVisible();
    await expect(main.getByText('Inventory Alerts')).toBeVisible();
    await expect(main.getByText('Today\'s Revenue')).toBeVisible();
    await expect(main.getByText('Quick Actions')).toBeVisible();
    await expect(main.getByText('Launch POS')).toBeVisible();

    // Verify Property Host Dashboard Content is NOT rendered
    await expect(main.getByText('Create Accommodation')).toBeHidden();
    await expect(main.getByText('Draft Properties')).toBeHidden();
    await expect(main.getByText('Pending Approval')).toBeHidden();
    await expect(main.getByText('Published Properties')).toBeHidden();

    // Verify Property Host links are hidden from navigation
    await expect(page.getByRole('link', { name: 'My Properties' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Applications' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Enquiries' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Chats' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Agency' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Leads' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Food Orders' })).toBeHidden();

    // Verify Retail links are accessible in navigation
    await expect(page.getByRole('link', { name: 'Business Overview' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'POS' }).first()).toBeVisible();
  });

  test('2. Retail account with legacy orgType (PROVIDER + category RETAIL) correctly renders Retail Dashboard', async ({
    page,
  }) => {
    const legacyRetailUser = {
      id: 'legacy-retail-usr',
      email: 'legacy.retail@jesmond.demo',
      role: 'ORG_STAFF',
      organizationId: 'org-legacy-1',
      orgType: 'PROVIDER',
      businessCategory: 'RETAIL',
      orgRole: 'ADMIN',
      permissions: ['*'],
      accountStatus: 'ACTIVE',
    };

    await setupAuthSession(page, legacyRetailUser);
    await page.goto('/portal');

    // Should route to /portal/retail
    await expect(page).toHaveURL(/\/portal\/retail/);

    // Header must be Retail Business Dashboard
    await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText(
      'Retail Business Dashboard',
    );

    // Verify Retail content is rendered
    const main = page.getByRole('main');
    await expect(main.getByText('Total Terminals')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Total Customers')).toBeVisible();
    await expect(main.getByText('Today\'s Revenue')).toBeVisible();

    // Verify Property Host content is NOT rendered
    await expect(main.getByText('Create Accommodation')).toBeHidden();
    await expect(main.getByText('Draft Properties')).toBeHidden();

    // Verify Sidebar isolation
    await expect(page.getByRole('link', { name: 'My Properties' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Applications' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Food Orders' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Business Overview' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'POS' }).first()).toBeVisible();
  });

  test('3. Accommodation Provider account continues to render Property Host Dashboard', async ({
    page,
  }) => {
    const providerUser = {
      id: 'provider-usr-1',
      email: 'host@jesmond.demo',
      role: 'ORG_STAFF',
      organizationId: 'org-prov-1',
      orgType: 'PROVIDER',
      orgRole: 'ADMIN',
      accountStatus: 'ACTIVE',
    };

    await setupAuthSession(page, providerUser);
    await page.goto('/portal');

    await expect(page).toHaveURL(/\/portal$/);

    // Header must be Service Provider Dashboard
    await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText(
      'Service Provider Dashboard',
    );

    // Verify Property Host content is rendered in main
    const main = page.getByRole('main');
    await expect(main.getByText('Create Accommodation')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('My Properties')).toBeVisible();

    // Verify Sidebar has Provider items
    await expect(page.getByRole('link', { name: 'My Properties' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Applications' }).first()).toBeVisible();

    // Verify Sidebar does NOT have Retail items
    await expect(page.getByRole('link', { name: 'Business Overview' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'POS' })).toBeHidden();
  });
});
