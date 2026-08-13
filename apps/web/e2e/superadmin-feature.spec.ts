// Super Admin feature flag verification test
import { test, expect } from '@playwright/test';

test('Super Admin feature flag enable/disable flow', async ({ page }) => {
  const logs: string[] = [];
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Capture failed network requests
  page.on('requestfailed', request => {
    requestFailures.push(`${request.method()} ${request.url()} -> ${request.failure()?.errorText}`);
  });

  // 1. Login as Super Admin
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email address').fill('superadmin@jesmond.demo');
  await page.getByLabel('Password').fill('Jesmond@Demo2026!');

  // Prepare to capture login request and feature‑flag request
  const loginRespPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/auth/login'));
  const flagRespPromise = page.waitForResponse(resp => /\/api\/v1\/admin\/features\/PAYMENTS_BOOKING(\?.*)?$/.test(resp.url()));

  await Promise.all([
    loginRespPromise,
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);

  const loginResp = await loginRespPromise;
  logs.push(`Login API status: ${loginResp.status()}`);
  expect(loginResp.status()).toBe(200);

  // 2. Wait for redirect to /admin and dashboard visible
  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { name: /Admin Dashboard/i })).toBeVisible();
  logs.push('Redirected to /admin and dashboard visible');

  // 3. Capture feature‑flag response (already awaited above)
  const flagResp = await flagRespPromise;
  const flagBody = await flagResp.json();
  logs.push(`Feature flag request method: ${flagResp.request().method()}`);
  logs.push(`Feature flag response status: ${flagResp.status()}`);
  logs.push(`Feature flag enabled: ${flagBody.enabled}`);
  expect(flagResp.status()).toBe(200);

  // 4. Verify Platform Controls (Feature Controls) section is visible
  const featureSection = page.locator('section', { hasText: 'Feature Controls' });
  await expect(featureSection).toBeVisible();
  logs.push('Feature Controls section visible');

  // Verify Payments & Booking header is present
  await expect(featureSection.getByText('Payments & Booking')).toBeVisible();
  logs.push('Payments & Booking heading visible');

  // Helper to capture the flag toggle request
  const captureToggleRequest = async () => {
    return await page.waitForResponse(resp => /\/api\/v1\/admin\/features\/PAYMENTS_BOOKING(\?.*)?$/.test(resp.url()));
  };

  // Determine current state via button text
  const toggleButton = featureSection.getByRole('button', { name: /Enable|Disable/ });
  const buttonText = await toggleButton.textContent();
  const statusBadge = featureSection.locator('span', { hasText: /ENABLED|DISABLED/ });
  const currentStatus = (await statusBadge.textContent())?.trim() || 'UNKNOWN';
  logs.push(`Initial Payments & Booking status: ${currentStatus}`);

  // ---------- ENABLE FLOW (if currently disabled) ----------
  if (buttonText?.includes('Enable')) {
    // Click Enable -> ConfirmationDialog
    await toggleButton.click();
    const confirmBtn = page.getByRole('button', { name: /Confirm/i });
    await expect(confirmBtn).toBeVisible();
    // Capture API request after confirming
    const enableRespPromise = page.waitForResponse(resp => /\/api\/v1\/admin\/features\/PAYMENTS_BOOKING(\?.*)?$/.test(resp.url()));
    await confirmBtn.click();
    const enableResp = await enableRespPromise;
    const enableBody = await enableResp.json();
    logs.push('Enable flow: API request captured after confirmation');
    logs.push(`Enable API method: ${enableResp.request().method()}`);
    logs.push(`Enable API status: ${enableResp.status()}`);
    logs.push(`Enable API response: ${JSON.stringify(enableBody)}`);
    expect(enableResp.status()).toBe(200);
    // Verify UI updates to ENABLED
    await expect(statusBadge).toHaveText(/ENABLED/i);
    await expect(toggleButton).toHaveText(/Disable/i);
    logs.push('Enable flow UI updated to ENABLED');
  } else {
    logs.push('Enable flow NOT NEEDED (already enabled)');
  }

  // ---------- DISABLE FLOW (always perform) ----------
  // Refresh references after possible UI change
  const toggleButtonAfter = featureSection.getByRole('button', { name: /Enable|Disable/ });
  await toggleButtonAfter.click();
  const confirmBtn2 = page.getByRole('button', { name: /Confirm/i });
  await expect(confirmBtn2).toBeVisible();
  // Capture API request after confirming
  const disableRespPromise = page.waitForResponse(resp => /\/api\/v1\/admin\/features\/PAYMENTS_BOOKING(\?.*)?$/.test(resp.url()));
  await confirmBtn2.click();
  const disableResp = await disableRespPromise;
  const disableBody = await disableResp.json();
  logs.push('Disable flow: API request captured after confirmation');
  logs.push(`Disable API method: ${disableResp.request().method()}`);
  logs.push(`Disable API status: ${disableResp.status()}`);
  logs.push(`Disable API response: ${JSON.stringify(disableBody)}`);
  expect(disableResp.status()).toBe(200);
  await expect(statusBadge).toHaveText(/DISABLED/i);
  await expect(toggleButtonAfter).toHaveText(/Enable/i);
  logs.push('Disable flow UI updated to DISABLED');
  // 5. Record any console or request errors
  if (consoleErrors.length) logs.push(`Console errors: ${consoleErrors.join(' | ')}`);
  if (requestFailures.length) logs.push(`Request failures: ${requestFailures.join(' | ')}`);

  // Attach log artifact for visibility
  test.info().attach('superadmin-regression-log', { body: logs.join('\n'), contentType: 'text/plain' });
});
