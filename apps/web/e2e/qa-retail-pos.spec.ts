import { test, expect } from '@playwright/test';

test.describe('Retail POS Checkout and Payment Flow Hardening', () => {
  test.setTimeout(45000);

  const branchId = 'default-branch-id';

  test.beforeEach(async ({ page }) => {
    // 1. Log in
    await page.goto('http://localhost:3000/login');
    await page.getByLabel('Email address').fill('provider@jesmond.demo');
    await page.getByLabel('Password').fill('Jesmond@Demo2026!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/portal');

    // Mock catalog GET request
    await page.route(`**/api/v1/retail/catalog?branchId=${branchId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'prod-1',
            name: 'Jesmond Hoodie',
            sku: 'JES-HOOD-01',
            barcode: '1111111',
            sellingPrice: 4500,
            isActive: true,
            category: { id: 'cat-1', name: 'Apparel' },
            quantity: 10
          },
          {
            id: 'prod-2',
            name: 'Jesmond Mug',
            sku: 'JES-MUG-02',
            barcode: '2222222',
            sellingPrice: 1500,
            isActive: true,
            category: { id: 'cat-2', name: 'Mugs' },
            quantity: 0
          }
        ])
      });
    });

    // Mock terminals GET request
    await page.route(`**/api/v1/retail/terminals`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'term-1',
            name: 'Stripe Reader 1',
            externalId: 'stripe_reader_1',
            provider: 'STRIPE',
            branchId: 'default-branch-id'
          }
        ])
      });
    });

    await page.goto('http://localhost:3000/portal/retail/pos');
  });

  test('POS Cash checkout flow with change calculation and success screen', async ({ page }) => {
    // Add Hoodie to cart
    await page.click('text=Jesmond Hoodie');
    await expect(page.getByText('$45.00')).toBeVisible();

    // Open checkout drawer
    await page.click('button:has-text("Review & Pay")');
    await expect(page.locator('text=Amount Due')).toBeVisible();
    await expect(page.locator('text=$45.00')).toBeVisible();

    // Select CASH and input amount received
    await page.click('button:has-text("CASH")');
    await page.fill('input[placeholder="e.g. 50.00"]', '50.00');

    // Check change calculation due: 50.00 - 45.00 = 5.00
    await expect(page.locator('text=Change to Customer:')).toBeVisible();
    await expect(page.locator('text=$5.00')).toBeVisible();

    // Mock order creation POST
    await page.route('**/api/v1/retail/orders', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ord-1234',
          orderNumber: 'ORD-MOCK-1234',
          total: 4500,
          createdAt: new Date().toISOString(),
          payments: [{ id: 'pay-123', status: 'PAID' }]
        })
      });
    });

    // Confirm Payment
    await page.click('button:has-text("Confirm Payment")');
    await expect(page.locator('text=Payment Successful!').first()).toBeVisible();
    await expect(page.locator('text=ORD-MOCK-1234')).toBeVisible();

    // Verify cart is cleared
    await page.click('button:has-text("New Sale")');
    await expect(page.locator('text=Cart is empty')).toBeVisible();
  });

  test('POS Card checkout flow, webhook polling, and simulated success', async ({ page }) => {
    // Add Hoodie to cart
    await page.click('text=Jesmond Hoodie');

    // Open checkout
    await page.click('button:has-text("Review & Pay")');

    // Select CARD and check terminal option
    await page.click('button:has-text("CARD / EFTPOS")');
    await expect(page.locator('select')).toBeVisible();

    // Mock order creation POST (PENDING status)
    await page.route('**/api/v1/retail/orders', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ord-5678',
          orderNumber: 'ORD-MOCK-5678',
          total: 4500,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          payments: [{ id: 'pay-5678', status: 'PENDING', provider: 'STRIPE', transactionId: 'pi_mock_123' }]
        })
      });
    });

    // Start payment
    await page.click('button:has-text("Confirm Payment")');
    await expect(page.locator('text=Waiting for card payment...')).toBeVisible();

    // Mock order status polling GET -> returns completed after webhook simulation
    await page.route('**/api/v1/retail/orders/ord-5678', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ord-5678',
          orderNumber: 'ORD-MOCK-5678',
          total: 4500,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
          payments: [{ id: 'pay-5678', status: 'PAID', provider: 'STRIPE', transactionId: 'pi_mock_123' }]
        })
      });
    });

    // Mock webhook simulation endpoint
    await page.route('**/api/v1/retail/pos/webhooks/stripe', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"SUCCESS"}' });
    });

    // Click trigger success webhook simulation
    await page.click('button:has-text("Trigger Success Event")');

    // Polling resolves -> shows success screen
    await expect(page.locator('text=Payment Successful!').first()).toBeVisible();
    await page.click('button:has-text("New Sale")');
  });

  test('POS Card checkout flow with simulated failure, retry, and cancellation', async ({ page }) => {
    // Add Hoodie to cart
    await page.click('text=Jesmond Hoodie');

    // Open checkout
    await page.click('button:has-text("Review & Pay")');

    // Select CARD
    await page.click('button:has-text("CARD / EFTPOS")');

    // Mock order creation POST (PENDING status)
    await page.route('**/api/v1/retail/orders', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ord-5678',
          orderNumber: 'ORD-MOCK-5678',
          total: 4500,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          payments: [{ id: 'pay-5678', status: 'PENDING', provider: 'STRIPE', transactionId: 'pi_mock_123' }]
        })
      });
    });

    await page.click('button:has-text("Confirm Payment")');
    await expect(page.locator('text=Waiting for card payment...')).toBeVisible();

    // Mock order status polling GET -> returns failed payment
    await page.route('**/api/v1/retail/orders/ord-5678', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ord-5678',
          orderNumber: 'ORD-MOCK-5678',
          total: 4500,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          payments: [{ id: 'pay-5678', status: 'FAILED', provider: 'STRIPE', transactionId: 'pi_mock_123' }]
        })
      });
    });

    // Mock webhook simulation endpoint for failure
    await page.route('**/api/v1/retail/pos/webhooks/stripe', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"SUCCESS"}' });
    });

    // Trigger failure simulation
    await page.click('button:has-text("Trigger Failure Event")');

    // Polling resolves to failure, checks UI shows retry buttons
    await expect(page.locator('text=Terminal reported card transaction failure.')).toBeVisible();
    await expect(page.locator('button:has-text("Retry Payment")')).toBeVisible();

    // Mock cancel order POST
    await page.route('**/api/v1/retail/orders/ord-5678/cancel', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"CANCELLED"}' });
    });

    // Click cancel checkout
    await page.click('button:has-text("Close / Cancel")');
    
    // Checkout modal should close and cart items must remain intact
    await expect(page.locator('text=Amount Due')).not.toBeVisible();
    await expect(page.getByText('$45.00')).toBeVisible();
  });
});
