import { test, expect } from '@playwright/test';

test.describe('Property Discovery Component End-to-End Tests', () => {
  test('PropertyDiscovery loads properties and handles tab switching & bounds without fetch errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Failed to fetch')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Load homepage
    await page.goto('/');

    // 2. Locate PropertyDiscovery section
    const discoverySection = page.locator('section').filter({ hasText: 'Curated living spaces' });
    await expect(discoverySection).toBeVisible();

    // Wait for properties loading indicator to disappear
    const loadingText = discoverySection.getByText('Loading properties...');
    if (await loadingText.isVisible()) {
      await expect(loadingText).toBeHidden({ timeout: 10000 });
    }

    // Check either property cards are rendered or "No properties found" empty state is shown (without network errors)
    const propertyCards = discoverySection.locator('a[href^="/property/"]');
    const noPropsMessage = discoverySection.getByText('No properties found');
    const hasCards = await propertyCards.count();
    const hasEmpty = await noPropsMessage.isVisible();

    expect(hasCards > 0 || hasEmpty).toBe(true);

    // 3. Test Tab Switching (Top Rated -> Available Now)
    const availableNowTab = discoverySection.getByRole('button', { name: 'Available Now' });
    await availableNowTab.click();

    // Wait for reloading to complete if loading spinner appears
    if (await loadingText.isVisible()) {
      await expect(loadingText).toBeHidden({ timeout: 10000 });
    }

    // 4. Test Search this area (if bounds changed)
    const searchAreaBtn = discoverySection.getByRole('button', { name: 'Search this area' });
    if (await searchAreaBtn.isVisible()) {
      await searchAreaBtn.click();
      if (await loadingText.isVisible()) {
        await expect(loadingText).toBeHidden({ timeout: 10000 });
      }
    }

    // Verify absolutely NO "Failed to fetch" console errors occurred throughout the flow
    expect(consoleErrors).toEqual([]);
  });
});

