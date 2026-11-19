import { test, expect } from '@playwright/test';

test.describe('Retail Inventory - Branch State & Empty Handling', () => {
  const corsHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
  };

  const mockRetailUser = {
    id: 'user-retail-1',
    email: 'retailer@jesmond.demo',
    role: 'ORG_STAFF',
    accountStatus: 'ACTIVE',
    organizationId: 'org-retail-1',
    orgType: 'RETAIL',
    businessCategory: 'RETAIL',
    orgRole: 'ADMIN',
    permissions: ['*'],
  };

  const setupRetailAuth = async (page: any) => {
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
            ...mockRetailUser,
            user: mockRetailUser,
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.addInitScript(
      ({ tokenVal, userVal }: { tokenVal: string; userVal: any }) => {
        window.localStorage.setItem('token', tokenVal);
        window.localStorage.setItem('access_token', tokenVal);
        window.localStorage.setItem('user', JSON.stringify(userVal));
        document.cookie = `access_token=${tokenVal}; path=/`;
      },
      { tokenVal: 'mock-valid-jwt.eyJzdWIiOiJ1c2VyLTEifQ.sig', userVal: mockRetailUser },
    );
  };

  test('Gracefully displays empty state and avoids infinite skeleton when no branches exist', async ({ page }) => {
    await setupRetailAuth(page);

    // Mock 0 branches returned from backend
    await page.route('**/api/v1/retail/branches', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify([]),
      });
    });

    await page.goto('/portal/retail/inventory');

    // Heading should be visible
    await expect(page.locator('h1')).toHaveText('Inventory');

    // Branch selector should be disabled and show "No branches found..."
    const branchSelect = page.locator('select');
    await expect(branchSelect).toBeVisible();
    await expect(branchSelect).toBeDisabled();
    await expect(branchSelect).toHaveValue('');

    // Empty state card must be visible with guidance to create branch
    await expect(page.locator('text=No retail branches found')).toBeVisible();
    await expect(
      page.locator('text=You need at least one active branch to manage inventory')
    ).toBeVisible();

    const setupBranchBtn = page.getByRole('button', { name: 'Set Up Your First Branch' });
    await expect(setupBranchBtn).toBeVisible();

    // Verify loading skeletons are gone - StatCards should display real values (0 or 100%)
    await expect(page.locator('text=Total Products').locator('..').locator('.text-2xl')).toHaveText('0');
    await expect(page.locator('text=Total Units').locator('..').locator('.text-2xl')).toHaveText('0');
    await expect(page.locator('text=Low Stock').locator('..').locator('.text-2xl')).toHaveText('0');
    await expect(page.locator('text=Healthy').locator('..').locator('.text-2xl')).toHaveText('100%');
  });

  test('Loads branch options and displays inventory when branches exist', async ({ page }) => {
    await setupRetailAuth(page);

    const mockBranches = [
      { id: 'branch-main', name: 'Main Street Store', isActive: true },
      { id: 'branch-mall', name: 'Westfield Mall Store', isActive: true },
    ];

    const mockInventory = [
      {
        id: 'inv-item-1',
        branchId: 'branch-main',
        productId: 'prod-item-1',
        quantity: 50,
        updatedAt: new Date().toISOString(),
        product: {
          id: 'prod-item-1',
          name: 'Jesmond Tote Bag Eco',
          sku: 'ECO-TOTE-01',
          sellingPrice: 1999,
          barcode: '9312345009999',
          category: { id: 'cat-1', name: 'Accessories' },
        },
      },
    ];

    await page.route('**/api/v1/retail/branches', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(mockBranches),
      });
    });

    await page.route('**/api/v1/retail/inventory/branch-main', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(mockInventory),
      });
    });

    await page.goto('/portal/retail/inventory');

    // Heading & Selector
    await expect(page.locator('h1')).toHaveText('Inventory');
    const branchSelect = page.locator('select');
    await expect(branchSelect).toBeEnabled();
    await expect(branchSelect).toHaveValue('branch-main');

    // Inventory product row rendered (visible on both desktop table and mobile list)
    await expect(page.locator('text=Jesmond Tote Bag Eco').filter({ visible: true })).toBeVisible();
    await expect(page.locator('text=ECO-TOTE-01').filter({ visible: true })).toBeVisible();

    // StatCards updated
    await expect(page.locator('text=Total Products').locator('..').locator('.text-2xl')).toHaveText('1');
    await expect(page.locator('text=Total Units').locator('..').locator('.text-2xl')).toHaveText('50');
  });

  test('Displays clear error state when branches API fails', async ({ page }) => {
    await setupRetailAuth(page);

    await page.route('**/api/v1/retail/branches', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Internal server error loading branches' }),
      });
    });

    await page.goto('/portal/retail/inventory');

    // Error banner displayed instead of stuck skeletons
    await expect(page.locator('text=Internal server error loading branches')).toBeVisible();
  });
});
