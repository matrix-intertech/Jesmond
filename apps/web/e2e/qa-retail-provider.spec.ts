import { test, expect } from '@playwright/test';

test('Retail Provider Dashboard & POS Flow', async ({ page }) => {
  const logs: string[] = [];
  
  test.setTimeout(60000);
  
  // 1. Login
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email address').fill('provider@jesmond.demo');
  await page.getByLabel('Password').fill('Jesmond@Demo2026!');

  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/portal*');

  // 2. Open Retail Dashboard
  await page.goto('http://localhost:3000/portal/retail');
  await expect(page.getByRole('heading', { name: /Retail Overview/i })).toBeVisible();
  
  // 3. Terminals
  await page.getByRole('link', { name: /Retail Terminals/i }).click();
  await expect(page).toHaveURL(/\/portal\/retail\/terminals/);
  await expect(page.getByRole('heading', { name: 'Terminals', exact: true })).toBeVisible();
  
  // 4. Products / Catalog
  await page.getByRole('link', { name: /Retail Catalog/i }).click();
  await expect(page).toHaveURL(/\/portal\/retail\/catalog/);
  // Verify gracefully degraded empty state
  await expect(page.getByText(/Product Listing API Not Available/i)).toBeVisible();
  
  // Create a product
  await page.getByRole('button', { name: /Create Product Anyway/i }).click();
  await page.getByLabel('Product Name').fill('Playwright Test Item');
  await page.getByLabel('SKU').fill(`TEST-SKU-${Date.now()}`);
  await page.getByLabel('Selling Price ($)').fill('19.99');
  
  const [createResp] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/v1/retail/catalog/products') && resp.request().method() === 'POST'),
    page.getByRole('button', { name: 'Create Product' }).click()
  ]);
  
  expect(createResp.status()).toBe(201);
  await expect(page.getByText(/Product created successfully/i)).toBeVisible();
  
  // 5. Customers
  await page.getByRole('link', { name: /Retail Customers/i }).click();
  await expect(page).toHaveURL(/\/portal\/retail\/customers/);
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  
  // 6. POS
  await page.getByRole('link', { name: /POS/i, exact: true }).click();
  await expect(page).toHaveURL(/\/portal\/retail\/pos/);
  
  // Verify gracefully degraded POS state
  await expect(page.getByText(/API Limitation/i)).toBeVisible();
  
  // Add item manually
  await page.getByLabel('Product ID').fill('00000000-0000-0000-0000-000000000000');
  await page.getByLabel('Price ($)').fill('19.99');
  await page.getByLabel('Quantity').fill('2');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  
  // Check cart total (19.99 * 2 = 39.98)
  await expect(page.getByText('$39.98')).toBeVisible();
  
  // Try to checkout with invalid branch ID
  await page.getByPlaceholder('Branch ID (Required)').fill('00000000-0000-0000-0000-000000000000');
  
  const [orderResp] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/v1/retail/orders') && resp.request().method() === 'POST'),
    page.getByRole('button', { name: 'Charge' }).click()
  ]);
  
  // Should fail because branch ID is invalid or product ID is invalid
  expect(orderResp.status()).toBeGreaterThanOrEqual(400);
});
