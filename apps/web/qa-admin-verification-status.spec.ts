import { test, expect } from '@playwright/test';

test.describe('Admin Property Verification Status', () => {
  test.setTimeout(45000);

  test('admin can update provider verification status from active listings', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'admin@jesmond.demo');
    await page.fill('input[type="password"]', 'Jesmond@Demo2026!');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Properties').first()).toBeVisible({ timeout: 12000 });
    
    // 2. Navigate to Admin Properties -> Active Listings
    await page.click('text=Properties');
    await page.waitForURL('**/admin/properties');
    
    await page.click('button:has-text("Active Listings")');
    await expect(page.locator('table')).toBeVisible();
    
    // 3. Open the first published property
    const firstPublishedRow = page.locator('tr:has(span:has-text("PUBLISHED"))').first();
    await expect(firstPublishedRow).toBeVisible();
    
    const reviewLink = firstPublishedRow.locator('text=Review →');
    await reviewLink.click();
    
    // 4. Property Detail Page
    await expect(page.locator('h1.font-outfit').first()).toBeVisible({ timeout: 8000 });
    
    // 5. Verify current Verification Status is visible
    const verificationBadge = page.locator('text=Verification Status:').locator('..').locator('span').nth(1);
    await expect(verificationBadge).toBeVisible();
    const initialStatus = await verificationBadge.innerText();
    
    // 6. Open the Change Verification Status control
    const changeBtn = page.locator('button', { hasText: 'Change Verification' });
    await expect(changeBtn).toBeVisible();
    await changeBtn.click();
    
    // 7. Verify options
    await expect(page.locator('button', { hasText: /^PENDING$/ })).toBeVisible();
    await expect(page.locator('button', { hasText: /^VERIFIED$/ })).toBeVisible();
    await expect(page.locator('button', { hasText: /^REJECTED$/ })).toBeVisible();
    await expect(page.locator('button', { hasText: /^SUSPENDED$/ })).toBeVisible();
    
    // 8. Change status to something else (e.g., PENDING if VERIFIED, else VERIFIED)
    const targetStatus = initialStatus === 'VERIFIED' ? 'PENDING' : 'VERIFIED';
    
    // Handle JS confirmation dialog
    page.once('dialog', dialog => dialog.accept());
    
    await page.locator('button', { hasText: new RegExp(`^${targetStatus}$`) }).click();
    
    // 9. Verify success notification and updated badge
    await expect(page.locator(`text=Verification status updated to ${targetStatus}`)).toBeVisible({ timeout: 8000 });
    await expect(verificationBadge).toHaveText(targetStatus);
    
    // 10. Reload and verify persistence
    await page.reload();
    await expect(page.locator('h1.font-outfit').first()).toBeVisible({ timeout: 8000 });
    const refreshedBadge = page.locator('text=Verification Status:').locator('..').locator('span').nth(1);
    await expect(refreshedBadge).toHaveText(targetStatus);
    
    // 11. Revert back to original status to avoid messing up other tests
    await changeBtn.click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('button', { hasText: new RegExp(`^${initialStatus}$`) }).click();
    await expect(page.locator(`text=Verification status updated to ${initialStatus}`)).toBeVisible({ timeout: 8000 });
  });
});
