import { test, expect } from '@playwright/test';

test.describe('Accommodation Provider Restoration & Retail Guard Isolation', () => {
  const restoredProviderUser = {
    id: '0b0ad15f-5c50-4801-a5be-ceef2df31e36',
    email: 'allienshaurya@gmail.com',
    firstName: 'allienshaurya',
    lastName: 'User',
    role: 'ORG_STAFF',
    orgType: 'PROVIDER',
    businessCategory: 'RENTALS',
    organizationId: '60c68f92-da28-4ac5-b3cf-72a28a2a7f33',
    accountStatus: 'PENDING_VERIFICATION',
    emailVerified: true,
    capabilities: [],
  };

  const setupAuthSession = async (page: any, user = restoredProviderUser) => {
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

      if (url.includes('/properties/my')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            data: [
              { id: '82936021-ba79-4521-9ac4-fd68f6e6f25a', name: 'Demo House', status: 'PUBLISHED' },
              { id: 'a230f971-843f-4a6f-afc3-e0dcded86b78', name: 'Demo Apartment', status: 'PUBLISHED' },
            ],
          }),
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
      ({ u }) => {
        localStorage.setItem('auth_token', 'mock-valid-jwt.eyJzdWIiOiIwYjBhZDE1Zi01YzUwLTQ4MDEtYTViZS1jZWVmMmRmMzFlMzYifQ.sig');
        localStorage.setItem('user', JSON.stringify(u));
        sessionStorage.setItem('auth_token', 'mock-valid-jwt.eyJzdWIiOiIwYjBhZDE1Zi01YzUwLTQ4MDEtYTViZS1jZWVmMmRmMzFlMzYifQ.sig');
        sessionStorage.setItem('user', JSON.stringify(u));
      },
      { u: user }
    );
  };

  test('renders Service Provider Dashboard and accommodation sections for restored provider', async ({ page }) => {
    await setupAuthSession(page);
    await page.goto('/portal');

    // Heading should be Service Provider Dashboard
    await expect(page.getByRole('heading', { name: /Service Provider Dashboard/i })).toBeVisible({ timeout: 10000 });

    // Provider sidebar navigation items should be visible
    await expect(page.locator('aside').getByRole('link', { name: /My Properties/i })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: /Applications/i })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: /Enquiries/i })).toBeVisible();

    // Retail sidebar links should NOT be present
    await expect(page.locator('aside').getByRole('link', { name: /Retail Dashboard/i })).not.toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: /POS Terminal/i })).not.toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: /Inventory/i })).not.toBeVisible();
  });

  test('blocks restored Accommodation Provider from accessing /portal/retail and redirects to /portal', async ({ page }) => {
    await setupAuthSession(page);
    await page.goto('/portal/retail');

    // RetailGuard should redirect back to /portal
    await expect(page).toHaveURL(/\/portal(?!\/retail)/, { timeout: 10000 });
  });

  test('blocks restored Accommodation Provider from accessing /portal/retail/inventory and redirects to /portal', async ({ page }) => {
    await setupAuthSession(page);
    await page.goto('/portal/retail/inventory');

    // RetailGuard should redirect back to /portal
    await expect(page).toHaveURL(/\/portal(?!\/retail)/, { timeout: 10000 });
  });
});
