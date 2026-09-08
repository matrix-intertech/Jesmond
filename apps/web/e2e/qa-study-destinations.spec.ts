import { test, expect } from '@playwright/test';

test.describe('Study Destinations and Map Preview Navigation Tests', () => {
  test.setTimeout(60000);

  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });
  });

  test('MapPreviewSection: Explore buttons navigate to valid city destinations for Melbourne, Sydney, and Brisbane', async ({ page }) => {
    // 1. Go to homepage
    await page.goto('/');

    // Locate "Where are you planning to study?" section
    const mapSection = page.locator('section').filter({ hasText: 'Where are you planning' });
    await expect(mapSection).toBeVisible();

    // --- Melbourne ---
    // Melbourne is active by default in MapPreviewSection
    const exploreMelbourneLink = mapSection.getByRole('link', { name: /Explore Melbourne/i });
    await expect(exploreMelbourneLink).toBeVisible();
    await exploreMelbourneLink.click();
    await page.waitForURL(url => url.pathname.includes('/melbourne'));
    await expect(page.getByRole('heading', { name: /Melbourne/i }).first()).toBeVisible();

    // --- Sydney ---
    await page.goto('/');
    const sydneyTab = mapSection.getByRole('button', { name: /Sydney/i });
    await sydneyTab.click();
    const exploreSydneyLink = mapSection.getByRole('link', { name: /Explore Sydney/i });
    await expect(exploreSydneyLink).toBeVisible();
    await exploreSydneyLink.click();
    await page.waitForURL(url => url.pathname.includes('/sydney'));
    await expect(page.getByRole('heading', { name: /Sydney/i }).first()).toBeVisible();

    // --- Brisbane ---
    await page.goto('/');
    const brisbaneTab = mapSection.getByRole('button', { name: /Brisbane/i });
    await brisbaneTab.click();
    const exploreBrisbaneLink = mapSection.getByRole('link', { name: /Explore Brisbane/i });
    await expect(exploreBrisbaneLink).toBeVisible();
    await exploreBrisbaneLink.click();
    await page.waitForURL(url => url.pathname.includes('/brisbane'));
    await expect(page.getByRole('heading', { name: /Brisbane/i }).first()).toBeVisible();

    // Verify no unhandled React errors
    const hasReactLoop = consoleErrors.some(err => err.includes('Maximum update depth exceeded'));
    expect(hasReactLoop).toBe(false);
  });

  test('StudyDestinations: Explore City links navigate to valid destinations', async ({ page }) => {
    await page.goto('/');

    const destSection = page.locator('section').filter({ hasText: 'Where do you actually' });
    await expect(destSection).toBeVisible();

    // --- Melbourne ---
    const exploreMelbLink = destSection.getByRole('link', { name: /Explore City/i });
    await expect(exploreMelbLink).toBeVisible();
    await exploreMelbLink.click();
    await page.waitForURL(url => url.pathname.includes('/melbourne'));

    // --- Sydney ---
    await page.goto('/');
    const sydneyTab = destSection.getByRole('button', { name: /Sydney/i });
    await sydneyTab.click();
    const exploreSydLink = destSection.getByRole('link', { name: /Explore City/i });
    await expect(exploreSydLink).toBeVisible();
    await exploreSydLink.click();
    await page.waitForURL(url => url.pathname.includes('/sydney'));

    // --- Brisbane ---
    await page.goto('/');
    const brisbaneTab = destSection.getByRole('button', { name: /Brisbane/i });
    await brisbaneTab.click();
    const exploreBrisLink = destSection.getByRole('link', { name: /Explore City/i });
    await expect(exploreBrisLink).toBeVisible();
    await exploreBrisLink.click();
    await page.waitForURL(url => url.pathname.includes('/brisbane'));
  });
});
