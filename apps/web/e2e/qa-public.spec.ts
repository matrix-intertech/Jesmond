import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Phase 1: Public Website Walkthrough', () => {
  test('Capture all public routes', async ({ page }) => {
    const routes = [
      '/',
      '/contact',
      '/cost',
      '/guide',
      '/moving',
      '/pricing',
      '/safety',
      '/support',
      '/terms',
      '/visa',
      '/login',
      '/register'
    ];

    for (const route of routes) {
      console.log(`Navigating to ${route}`);
      const res = await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' });
      // Ensure the directory exists
      fs.mkdirSync('f:/Jesmond2.0/qa-screenshots', { recursive: true });
      
      const routeName = route === '/' ? 'home' : route.replace(/\//g, '_');
      await page.screenshot({ path: `f:/Jesmond2.0/qa-screenshots/${routeName}.png`, fullPage: true });
      
      // Basic check for 404 text
      const content = await page.content();
      if (content.includes('404') && content.toLowerCase().includes('not found')) {
         console.log(`WARNING: ${route} might be a 404`);
      }
    }
  });

  test('Test Search and Property Detail', async ({ page }) => {
    await page.goto('http://localhost:3000/search', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `f:/Jesmond2.0/qa-screenshots/search.png`, fullPage: true });

    const firstProperty = page.locator('h3').first();
    if (await firstProperty.isVisible()) {
        await firstProperty.click();
        await page.waitForURL(/\/property\/.*/, { timeout: 15000 });
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: `f:/Jesmond2.0/qa-screenshots/property_detail.png`, fullPage: true });
    }
  });
});
