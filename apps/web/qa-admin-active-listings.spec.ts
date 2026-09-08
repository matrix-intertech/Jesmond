import { test, expect } from '@playwright/test';

test.describe('Admin Property Management', () => {
  // Use timeouts specified by prompt
  test.setTimeout(45000); // 45s total

  test('admin can navigate tabs and manage active properties', async ({ page }) => {
    // 1. Admin Login
    await page.goto('http://localhost:3000/login', { timeout: 12000 });
    await page.fill('input[type="email"]', 'admin@jesmond.demo', { timeout: 8000 });
    await page.fill('input[type="password"]', 'Jesmond@Demo2026!', { timeout: 8000 });
    await page.click('button[type="submit"]', { timeout: 8000 });
    
    // Wait for redirect to admin dashboard
    await expect(page.locator('text=Properties').first()).toBeVisible({ timeout: 12000 });
    
    // 2. Admin Properties
    await page.click('text=Properties', { timeout: 8000 });
    await page.waitForURL('**/admin/properties', { timeout: 12000 });

    // 3. For Review Tab
    await expect(page.locator('button', { hasText: 'For Review' })).toBeVisible({ timeout: 8000 });
    
    // 4. Active Listings Tab
    await page.click('button:has-text("Active Listings")', { timeout: 8000 });
    
    // 5. Active property visible
    await expect(page.locator('table')).toBeVisible({ timeout: 8000 });
    
    // 6. Verification status visible (PUBLISHED)
    const firstPublishedRow = page.locator('tr:has(span:has-text("PUBLISHED"))').first();
    await expect(firstPublishedRow).toBeVisible({ timeout: 8000 });
    
    // 7. Open property
    const reviewLink = firstPublishedRow.locator('text=Review →');
    await reviewLink.click({ timeout: 8000 });
    
    await expect(page.locator('h1.font-outfit').first()).toBeVisible({ timeout: 8000 });
    
    // Deactivate / Unpublish test
    const unpublishBtn = page.locator('button', { hasText: 'Deactivate / Unpublish' });
    await expect(unpublishBtn).toBeVisible({ timeout: 8000 });
    
    // Test clicking it and canceling the prompt
    page.on('dialog', dialog => dialog.dismiss());
    await unpublishBtn.click({ timeout: 8000 });
    
    // List refresh can be tested by going back
    await page.click('text=Properties', { timeout: 8000 });
    await expect(page.locator('h1', { hasText: 'Properties' })).toBeVisible({ timeout: 8000 });
  });
});
