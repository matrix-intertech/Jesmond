import { test, expect } from '@playwright/test';

test.describe('Student Marketplace Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Optionally clear any state, but since we reuse the same DB, we will just login
  });

  test('Guest -> property detail -> Apply -> login', async ({ page }) => {
    await page.goto('http://localhost:3000/search');
    
    // Wait for the search results to load
    const firstPropertyCard = page.locator('h3').first();
    await expect(firstPropertyCard).toBeVisible({ timeout: 15000 });
    
    // Click the card
    await firstPropertyCard.click();
    
    // Wait for URL to change to /property
    await page.waitForURL(/\/property\/.*/, { timeout: 15000 });
    
    // Check if the property page loaded
    await expect(page.locator('h1').first()).toBeVisible();

    // The Apply button when logged out says "Sign up to reserve"
    const reserveLink = page.getByRole('link', { name: /sign up to reserve/i }).first();
    await expect(reserveLink).toBeVisible();
    await reserveLink.click();
    
    await expect(page).toHaveURL(/.*\/register/);
  });

  test('Student full flow: login -> search -> property -> save -> apply -> track -> saved', async ({ page }) => {
    // 1. Login
    await page.goto('http://localhost:3000/login');
    await page.getByLabel('Email address').fill('student@jesmond.demo');
    await page.getByLabel('Password').fill('Jesmond@Demo2026!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/student', { timeout: 30000 });
    await expect(page.locator('h1', { hasText: 'Student Dashboard' })).toBeVisible();

    // 2. Search
    await page.getByRole('link', { name: 'Find Accommodation' }).first().click();
    await expect(page).toHaveURL(/.*\/search/);
    
    // Wait for results
    const firstPropertyCard = page.locator('h3').first();
    await expect(firstPropertyCard).toBeVisible({ timeout: 15000 });
    
    // 3. Open real property
    await firstPropertyCard.click();
    await page.waitForURL(/\/property\/.*/, { timeout: 15000 });
    await expect(page.locator('h1').first()).toBeVisible();

    // 4. Save property
    const saveButton = page.locator('button[title="Save Property"], button[title="Unsave Property"]').first();
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // 5. Apply
    const reserveButton = page.getByRole('button', { name: 'Reserve Room' }).first();
    await reserveButton.click();

    // Fill application form (Move in Date and Duration)
    await expect(page.getByRole('heading', { name: 'Reserve Room' })).toBeVisible();
    
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill('2026-10-01');

    const durationSelect = page.locator('select');
    await durationSelect.selectOption('6');

    const submitBtn = page.getByRole('button', { name: 'Submit Application' });
    await submitBtn.click();

    // Verify success
    await expect(page.getByRole('heading', { name: 'Application Submitted' })).toBeVisible({ timeout: 15000 });

    // 6. Application tracking
    await page.getByRole('link', { name: 'View My Applications' }).click();
    await expect(page).toHaveURL(/.*\/student/);
    
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('td', { hasText: 'Pending Review' }).first()).toBeVisible();

    // 7. Saved properties
    await page.getByRole('link', { name: 'Saved Properties' }).first().click();
    await expect(page).toHaveURL(/.*\/student\/saved/);
    await expect(page.locator('h1', { hasText: 'Saved Properties' })).toBeVisible();
    
    // 8. Logout
    await page.goto('http://localhost:3000/');
    const userMenu = page.locator('button:has-text("S")').first(); 
    if (await userMenu.isVisible()) {
        await userMenu.click();
        const logout = page.getByRole('menuitem', { name: 'Sign out' });
        if (await logout.isVisible()) {
            await logout.click();
        }
    }
  });
});
