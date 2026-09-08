import { test, expect } from '@playwright/test';

test.describe('Search Map Experience', () => {
  test('Verify search map and list synchronization', async ({ page }) => {
    test.setTimeout(45000);

    // 1. Open public search/discovery page. (assuming /search or /list or / portal. PropertyDiscovery is used on the home page maybe?)
    // Wait, PropertyDiscovery is used on `/`. Let's use `/`.
    await page.goto('http://localhost:3000/');

    // 2. Verify map renders.
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 15000 });

    // 3. Verify at least one marker exists when search results exist.
    const markers = page.locator('.leaflet-marker-icon');
    await expect(markers.first()).toBeVisible({ timeout: 10000 });

    // 4. Click marker.
    await markers.first().click({ force: true });

    // 5. Verify corresponding property/card highlight.
    // The clicked property should have the highlighted border.
    const highlightedCard = page.locator('.border-brand-orange');
    await expect(highlightedCard).toBeVisible({ timeout: 5000 });

    // 6. Change an existing filter.
    const closestToCampusBtn = page.getByRole('button', { name: 'Closest to Campus' });
    if (await closestToCampusBtn.isVisible()) {
      await closestToCampusBtn.click();
      await page.waitForTimeout(1000); // Wait for API
    }

    // 7. Verify markers update with results.
    await expect(markers.first()).toBeVisible({ timeout: 10000 });

    // 8. Pan the map.
    await mapContainer.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.up();

    // 9. Verify "Search this area" appears.
    const searchAreaBtn = page.getByRole('button', { name: 'Search this area' });
    await expect(searchAreaBtn).toBeVisible({ timeout: 5000 });

    // 11. Verify network request contains map bounds.
    const requestPromise = page.waitForRequest(
      (request) => request.url().includes('bounds=') && request.method() === 'GET'
    );

    // 10. Click "Search this area".
    await searchAreaBtn.click();

    // Wait for the request
    const request = await requestPromise;
    expect(request.url()).toContain('bounds=');

    // 12. Verify results/markers update.
    await expect(markers.first()).toBeVisible({ timeout: 10000 });
    
    // Ensure "Search this area" disappears
    await expect(searchAreaBtn).not.toBeVisible();

    // 13. Open a property from the list.
    const viewDetailsBtn = page.getByRole('button', { name: 'View details' }).first();
    await viewDetailsBtn.click();

    // Wait for navigation
    await page.waitForURL('**/property/*');

    // 14. Verify property detail page contains its map.
    const detailMapContainer = page.locator('.leaflet-container');
    await expect(detailMapContainer).toBeVisible({ timeout: 15000 });

    // 15. Verify property marker is present.
    const detailMarkers = page.locator('.leaflet-marker-icon');
    await expect(detailMarkers).toHaveCount(1);
  });
});
