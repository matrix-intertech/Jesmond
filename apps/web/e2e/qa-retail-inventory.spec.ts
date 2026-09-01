import { test, expect } from '@playwright/test';

test.describe('Retail Inventory Workspace', () => {
  // Max timeout 45 seconds
  test.setTimeout(45000);

  const branchId = 'default-branch-id';
  const productId = 'prod-123';

  test.beforeEach(async ({ page }) => {
    // Login as provider to get real auth state
    await page.goto('/login');
    await page.getByLabel('Email address').fill('provider@jesmond.demo');
    await page.getByLabel('Password').fill('Jesmond@Demo2026!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/portal');

    // Mock the inventory GET API
    await page.route(`**/api/v1/retail/inventory/${branchId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'inv-1',
            branchId,
            productId,
            quantity: 24,
            updatedAt: new Date().toISOString(),
            product: {
              id: productId,
              name: 'Jesmond Tote Bag',
              sku: 'JES-TOTE-01',
              sellingPrice: 1500,
              barcode: '123456789',
              category: { id: 'cat-1', name: 'Accessories' }
            }
          },
          {
            id: 'inv-2',
            branchId,
            productId: 'prod-999',
            quantity: 0,
            updatedAt: new Date().toISOString(),
            product: {
              id: 'prod-999',
              name: 'Jesmond Cap',
              sku: 'JES-CAP-BLK',
              sellingPrice: 2000,
              barcode: null,
              category: null
            }
          }
        ])
      });
    });

    await page.goto('/portal/retail/inventory');
  });

  test('Inventory workspace loads and displays KPIs', async ({ page }) => {
    await expect(page.locator('text=Inventory')).toBeVisible();
    await expect(page.locator('text=Manage stock levels')).toBeVisible();

    // KPIs
    await expect(page.locator('text=Total Products')).toBeVisible();
    await expect(page.locator('text=Total Units')).toBeVisible();
    
    // We expect 2 products based on mock
    const statCards = page.locator('.text-2xl');
    await expect(statCards.nth(0)).toHaveText('2'); // Total Products
    await expect(statCards.nth(1)).toHaveText('24'); // Total Units
    await expect(statCards.nth(2)).toHaveText('0'); // Low Stock
    await expect(statCards.nth(3)).toHaveText('50%'); // Healthy
  });

  test('Branch selector works', async ({ page }) => {
    const select = page.locator('select');
    await expect(select).toHaveValue(branchId);
    
    // Mock the second branch
    await page.route(`**/api/v1/retail/inventory/branch-east`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await select.selectOption('branch-east');
    // Wait for empty state
    await expect(page.locator('text=Your inventory is empty')).toBeVisible();
  });

  test('Search and stock filters work', async ({ page }) => {
    // Search
    await page.fill('input[placeholder="Search product, SKU or barcode..."]', 'Tote');
    await expect(page.locator('text=Jesmond Tote Bag')).toBeVisible();
    await expect(page.locator('text=Jesmond Cap')).not.toBeVisible();

    await page.fill('input[placeholder="Search product, SKU or barcode..."]', '');

    // Filters
    await page.click('button:has-text("OUT OF STOCK")');
    await expect(page.locator('text=Jesmond Cap')).toBeVisible();
    await expect(page.locator('text=Jesmond Tote Bag')).not.toBeVisible();
  });

  test('Product detail drawer and stock adjustment works', async ({ page }) => {
    await page.click('text=Jesmond Tote Bag');
    
    // Drawer opens
    await expect(page.locator('h2', { hasText: 'Jesmond Tote Bag' })).toBeVisible();
    await expect(page.locator('text=Current Stock').locator('..').locator('text=24')).toBeVisible();

    // Open Adjustment
    await page.click('button:has-text("Adjust Stock")');
    
    // Mock the POST response
    await page.route(`**/api/v1/retail/inventory/${branchId}/${productId}/adjust`, async (route) => {
      const request = route.request();
      expect(request.method()).toBe('POST');
      
      const body = JSON.parse(request.postData() || '{}');
      expect(body.quantity).toBe(6);
      expect(body.reason).toBe('STOCK_RECEIPT');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          quantity: 30,
          updatedAt: new Date().toISOString()
        })
      });
    });

    // Fill form
    await page.fill('input[type="number"]', '6');
    await page.selectOption('select:has(option[value="STOCK_RECEIPT"])', 'STOCK_RECEIPT');

    // Submit
    await page.click('button:has-text("Apply Adjustment")');

    // Success State
    await expect(page.locator('text=Stock Updated')).toBeVisible();
    await expect(page.locator('text=Stock updated! Previous: 24, New: 30')).toBeVisible();
  });

  test('Error state works for negative stock', async ({ page }) => {
    await page.click('text=Jesmond Tote Bag');
    await page.click('button:has-text("Adjust Stock")');
    
    await page.click('button:has-text("Remove Stock")');
    await page.fill('input[type="number"]', '50'); // Current is 24, so this makes it -26
    
    // The projected stock should turn red
    const projected = page.locator('text=Projected Stock').locator('..').locator('span:last-child');
    await expect(projected).toHaveText('-26');
    await expect(projected).toHaveClass(/text-rose-600/);

    // Apply button should be disabled
    const applyBtn = page.locator('button:has-text("Apply Adjustment")');
    await expect(applyBtn).toBeDisabled();
  });

  test('Mobile layout checking (no console errors)', async ({ page }) => {
    // Set viewport to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.reload();
    await expect(page.locator('text=Inventory')).toBeVisible();
    
    expect(errors.length).toBe(0);
  });
});
