import { test, expect } from '@playwright/test';

test.describe('Homepage Quick Search End-to-End Tests', () => {
  test('Popular Universities quick search options filter results correctly', async ({ page }) => {
    await page.goto('/');

    const mainContent = page.locator('main');

    // 1. Click Monash University
    await page.locator('a[href="/search?university=monash"]').click();
    await expect(page).toHaveURL(/\/search\?university=monash/);
    await expect(mainContent.getByText('Monash')).toBeVisible();

    // 2. Click University of Melbourne
    await page.goto('/');
    await page.locator('a[href="/search?university=unimelb"]').click();
    await expect(page).toHaveURL(/\/search\?university=unimelb/);
    await expect(page.locator('h1')).toContainText('unimelb');

    // 3. Click UNSW Sydney
    await page.goto('/');
    await page.locator('a[href="/search?university=unsw"]').click();
    await expect(page).toHaveURL(/\/search\?university=unsw/);
    await expect(page.locator('h1')).toContainText('unsw');

    // 4. Click RMIT
    await page.goto('/');
    await page.locator('a[href="/search?university=rmit"]').click();
    await expect(page).toHaveURL(/\/search\?university=rmit/);
    await expect(page.locator('h1')).toContainText('rmit');
  });

  test('Room Types quick search options filter results correctly', async ({ page }) => {
    await page.goto('/');

    // 1. Click Private Studio
    await page.locator('a[href="/search?roomType=studio"]').click();
    await expect(page).toHaveURL(/\/search\?roomType=studio/);
    await expect(page.locator('h1')).toContainText('Studio');

    // 2. Click En-suite Room
    await page.goto('/');
    await page.locator('a[href="/search?roomType=ensuite"]').click();
    await expect(page).toHaveURL(/\/search\?roomType=ensuite/);

    // 3. Click Shared Room
    await page.goto('/');
    await page.locator('a[href="/search?roomType=shared"]').click();
    await expect(page).toHaveURL(/\/search\?roomType=shared/);

    // 4. Click Entire Apartment
    await page.goto('/');
    await page.locator('a[href="/search?roomType=apartment"]').click();
    await expect(page).toHaveURL(/\/search\?roomType=apartment/);
  });

  test('Budget & Move-in quick search options filter results correctly', async ({ page }) => {
    await page.goto('/');

    // 1. Click Under $300/wk
    await page.locator('a[href="/search?maxPrice=300"]').click();
    await expect(page).toHaveURL(/\/search\?maxPrice=300/);

    // 2. Click Premium ($500+)
    await page.goto('/');
    await page.locator('a[href="/search?minPrice=500"]').click();
    await expect(page).toHaveURL(/\/search\?minPrice=500/);

    // 3. Click Available Now
    await page.goto('/');
    await page.locator('a[href="/search?moveIn=immediate"]').click();
    await expect(page).toHaveURL(/\/search\?moveIn=immediate/);
  });
});
