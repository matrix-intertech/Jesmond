import { test, expect } from '@playwright/test';

test.describe('Business Location Selection (Leaflet + OpenStreetMap)', () => {
  const corsHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
  };

  const setupRetailSession = async (
    page: any,
    initialLocation: { address: string | null; lat: number | null; lng: number | null } = {
      address: null,
      lat: null,
      lng: null,
    },
  ) => {
    let currentLocationState = { ...initialLocation };

    page.on('pageerror', (err: any) => console.log('BROWSER PAGE ERROR:', err.message, err.stack));
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') console.log('BROWSER CONSOLE ERROR:', msg.text());
    });

    await page.route(/\/api\/v1\//, async (route: any) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            id: 'usr-retail-1',
            email: 'retailer@jesmond.demo',
            role: 'ORG_STAFF',
            organizationId: 'org-retail-1',
            orgType: 'RETAIL',
            businessCategory: 'RETAIL',
            orgRole: 'ADMIN',
            permissions: ['*'],
            accountStatus: 'ACTIVE',
            user: {
              id: 'usr-retail-1',
              email: 'retailer@jesmond.demo',
              role: 'ORG_STAFF',
              organizationId: 'org-retail-1',
              orgType: 'RETAIL',
              businessCategory: 'RETAIL',
              orgRole: 'ADMIN',
              permissions: ['*'],
              accountStatus: 'ACTIVE',
            },
          }),
        });
        return;
      }

      if (url.includes('/retail/businesses/profile')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            name: 'Demo Retail Store',
            type: 'RETAIL',
            businessCategory: 'RETAIL',
            timezone: 'Australia/Sydney',
            isPubliclyVisible: true,
          }),
        });
        return;
      }

      if (url.includes('/business/name-change-requests')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify(null),
        });
        return;
      }

      if (url.includes('/business/credentials/requirements')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            organizationId: 'org-retail-1',
            organizationName: 'Demo Retail Store',
            businessCategory: 'RETAIL',
            state: 'NSW',
            branchAddress: null,
            selectedServices: [],
            abn: '12345678901',
            abnStatus: 'VERIFIED',
            abnExemptionReason: null,
            overallStatus: 'VERIFIED',
            isCompleted: true,
            dismissedUntil: null,
            requirements: [],
          }),
        });
        return;
      }

      if (url.includes('/settings/profile')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            profileCompletion: { isComplete: true, missingFields: [] },
          }),
        });
        return;
      }

      if (url.includes('/retail/businesses/location')) {
        if (method === 'PATCH') {
          const body = JSON.parse(route.request().postData() || '{}');
          currentLocationState = {
            address: body.address,
            lat: body.lat,
            lng: body.lng,
          };
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify(currentLocationState),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify(currentLocationState),
        });
        return;
      }

      if (url.includes('/locations/search')) {
        const parsedUrl = new URL(url);
        const query = (parsedUrl.searchParams.get('q') || '').toLowerCase();

        if (query.includes('martin') || query.includes('sydney')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify([
              {
                id: 'loc-1',
                name: 'Martin Place, Sydney NSW 2000, Australia',
                address: 'Martin Place, Sydney NSW 2000, Australia',
                road: 'Martin Place',
                streetNumber: '1',
                streetAddress: '1 Martin Place',
                city: 'Sydney',
                state: 'NSW',
                postcode: '2000',
                country: 'Australia',
                lat: -33.8675,
                lng: 151.2070,
              },
            ]),
          });
          return;
        }

        if (query.includes('bourke') || query.includes('melbourne')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify([
              {
                id: 'loc-2a',
                name: 'Bourke Street Mall, Melbourne VIC 3000, Australia',
                address: 'Bourke Street Mall, Melbourne VIC 3000, Australia',
                label: 'Bourke Street Mall, Melbourne VIC 3000, Australia',
                road: 'Bourke Street',
                streetNumber: '250',
                streetAddress: '250 Bourke Street',
                city: 'Melbourne',
                state: 'VIC',
                postcode: '3000',
                country: 'Australia',
                lat: -37.8136,
                lng: 144.9631,
              },
              {
                id: 'loc-2b',
                name: 'Bourke Street East, Melbourne VIC 3000, Australia',
                address: 'Bourke Street East, Melbourne VIC 3000, Australia',
                label: 'Bourke Street East, Melbourne VIC 3000, Australia',
                road: 'Bourke Street',
                streetNumber: '100',
                streetAddress: '100 Bourke Street',
                city: 'Melbourne',
                state: 'VIC',
                postcode: '3000',
                country: 'Australia',
                lat: -37.8125,
                lng: 144.9690,
              },
            ]),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify([]),
        });
        return;
      }

      if (url.includes('/locations/reverse')) {
        const parsedUrl = new URL(url);
        const lat = parseFloat(parsedUrl.searchParams.get('lat') || '0');
        const lng = parseFloat(parsedUrl.searchParams.get('lng') || '0');

        if (lat === -999) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Reverse geocode service unavailable' }),
          });
          return;
        }

        if (Math.abs(lat - (-32.8991)) < 0.05) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({
              label: 'Shop 4, 12 Blue Gum Road, Jesmond NSW 2299, Australia',
              address: 'Shop 4, 12 Blue Gum Road, Jesmond NSW 2299, Australia',
              road: 'Blue Gum Road',
              streetNumber: '12',
              streetAddress: '12 Blue Gum Road',
              building: 'Jesmond Central',
              suburb: 'Jesmond',
              city: 'Newcastle',
              state: 'NSW',
              postcode: '2299',
              country: 'Australia',
              countryCode: 'AU',
              lat,
              lng,
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            address: `${Math.round(lat * 100) / 100}, ${Math.round(lng * 100) / 100} George Street, Sydney NSW 2000, Australia`,
            road: 'George Street',
            streetNumber: '100',
            streetAddress: '100 George Street',
            city: 'Sydney',
            state: 'NSW',
            postcode: '2000',
            country: 'Australia',
            lat,
            lng,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(
      ({ tokenVal, userVal }: { tokenVal: string; userVal: any }) => {
        window.localStorage.setItem('token', tokenVal);
        window.localStorage.setItem('access_token', tokenVal);
        window.localStorage.setItem('user', JSON.stringify(userVal));
      },
      {
        tokenVal: 'mock-valid-jwt.eyJzdWIiOiJ1c2VyLTEifQ.sig',
        userVal: {
          id: 'usr-retail-1',
          email: 'retailer@jesmond.demo',
          role: 'ORG_STAFF',
          organizationId: 'org-retail-1',
          orgType: 'RETAIL',
          businessCategory: 'RETAIL',
          orgRole: 'ADMIN',
        },
      },
    );
  };

  test('1. Initial State: shows Add Location prompt when no location exists, opens upgraded modal', async ({
    page,
  }) => {
    await setupRetailSession(page, { address: null, lat: null, lng: null });
    await page.goto('/portal/retail/business');

    // Page header and prompt check
    await expect(page.locator('h1')).toContainText('Business Profile');
    const addLocationBanner = page.locator('text=Add Your Location');
    await expect(addLocationBanner.first()).toBeVisible();

    // Click "Add Location" button
    await page.click('button:has-text("Add Location")');

    // Modal should be open with selection methods
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Business Location')).toBeVisible();

    // Verify method buttons and form fields
    await expect(modal.locator('button:has-text("Choose on Map")')).toBeVisible();
    await expect(modal.locator('button:has-text("Use Current Location")')).toBeVisible();
    await expect(modal.locator('input[placeholder*="Shop 4"]')).toBeVisible();
  });

  test('2. Method A: Manual address entry with automatic geocoding fallback on save', async ({
    page,
  }) => {
    await setupRetailSession(page, { address: null, lat: null, lng: null });
    await page.goto('/portal/retail/business');

    await page.click('button:has-text("Add Location")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Fill in manual address fields
    await modal.locator('input[placeholder*="Shop 4"]').fill('1 Martin Place');
    await modal.locator('input[placeholder*="Jesmond"]').fill('Sydney');
    await modal.locator('input[placeholder*="NSW"]').fill('NSW');
    await modal.locator('input[placeholder*="2299"]').fill('2000');
    await modal.locator('input[placeholder*="Australia"]').fill('Australia');

    // Save Location
    await modal.locator('button:has-text("Save Location")').click();

    // Modal should close upon successful save
    await expect(modal).not.toBeVisible();

    // Location details on page should display updated address and coordinates
    await expect(page.locator('text=Address:')).toBeVisible();
    await expect(page.getByText('1 Martin Place', { exact: false })).toBeVisible();
    await expect(page.getByText('-33.867500', { exact: false })).toBeVisible();
    await expect(page.getByText('151.207000', { exact: false })).toBeVisible();
  });

  test('3. Method B: Choose on Map with search, marker placement, reverse geocode, and confirm', async ({
    page,
  }) => {
    await setupRetailSession(page, {
      address: '100 George St, The Rocks NSW 2000',
      lat: -33.8568,
      lng: 151.2093,
    });
    await page.goto('/portal/retail/business');

    // Click Edit Location
    await page.click('button:has-text("Edit Location")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Switch to "Choose on Map" tab
    await modal.locator('button:has-text("Choose on Map")').click();

    // Verify map elements
    await expect(modal.locator('h3:has-text("Choose on Map")')).toBeVisible();
    await expect(modal.locator('text=Click map or drag pin to position')).toBeVisible();

    // Search for Bourke Street Melbourne
    const searchInput = modal.locator('input[placeholder*="Search address"]');
    await searchInput.fill('bourke melbourne');
    await modal.locator('button:has-text("Search")').click();

    // Suggestions dropdown
    const suggestionItem = modal.locator('button:has-text("Bourke Street Mall")');
    await expect(suggestionItem).toBeVisible();
    await suggestionItem.click();

    // Verify coordinates badge updated to Melbourne coordinates
    await expect(modal.locator('text=Lat: -37.813600')).toBeVisible();
    await expect(modal.locator('text=Lng: 144.963100')).toBeVisible();

    // Click "Confirm Location"
    await modal.locator('button:has-text("Confirm Location")').click();

    // Modal switches back to form tab with values populated
    await expect(modal.locator('input[placeholder*="Shop 4"]')).toHaveValue('250 Bourke Street');
    await expect(modal.locator('input[placeholder*="Jesmond"]')).toHaveValue('Melbourne');
    await expect(modal.locator('input[placeholder*="NSW"]')).toHaveValue('VIC');
    await expect(modal.locator('input[placeholder*="2299"]')).toHaveValue('3000');

    // Save Location
    await modal.locator('button:has-text("Save Location")').click();
    await expect(modal).not.toBeVisible();

    // Verify page display updated
    await expect(page.locator('text=Address:')).toBeVisible();
    await expect(page.getByText('250 Bourke Street', { exact: false })).toBeVisible();
    await expect(page.getByText('-37.813600', { exact: false })).toBeVisible();
  });

  test('4. Method B: Choose on Map cancel button preserves previous values without saving', async ({
    page,
  }) => {
    await setupRetailSession(page, {
      address: '100 George St, The Rocks NSW 2000',
      lat: -33.8568,
      lng: 151.2093,
    });
    await page.goto('/portal/retail/business');

    await page.click('button:has-text("Edit Location")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Check initial street address value
    await expect(modal.locator('input[placeholder*="Shop 4"]')).toHaveValue('100 George St, The Rocks NSW 2000');

    // Switch to Map tab
    await modal.locator('button:has-text("Choose on Map")').click();

    // Search something different
    const searchInput = modal.locator('input[placeholder*="Search address"]');
    await searchInput.fill('bourke melbourne');
    await modal.locator('button:has-text("Search")').click();
    await modal.locator('button:has-text("Bourke Street Mall")').click();

    // Click Cancel in Map view
    await modal.locator('button:has-text("Cancel")').first().click();

    // Switched back to form tab, but previous address is retained
    await expect(modal.locator('input[placeholder*="Shop 4"]')).toHaveValue('100 George St, The Rocks NSW 2000');
  });

  test('5. Method C: Use Current Location with browser geolocation grant', async ({
    page,
    context,
  }) => {
    // Grant geolocation permissions and set coordinates to Sydney
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -33.8688, longitude: 151.2093 });

    await setupRetailSession(page, { address: null, lat: null, lng: null });
    await page.goto('/portal/retail/business');

    await page.click('button:has-text("Add Location")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Click "Use Current Location" - immediately triggers GPS detection
    await modal.locator('button:has-text("Use Current Location")').click();

    // It should resolve reverse geocode and display success alert
    await expect(modal.locator('text=Location detected successfully')).toBeVisible();
    await expect(modal.locator('input[placeholder*="Shop 4"]')).toHaveValue('100 George Street');
    await expect(modal.locator('input[placeholder*="Jesmond"]')).toHaveValue('Sydney');
    await expect(modal.locator('input[placeholder*="NSW"]')).toHaveValue('NSW');
    await expect(modal.locator('input[placeholder*="2299"]')).toHaveValue('2000');

    // Save and verify on page
    await modal.locator('button:has-text("Save Location")').click();
    await expect(modal).not.toBeVisible();

    await expect(page.locator('text=Address:')).toBeVisible();
    await expect(page.getByText('100 George Street', { exact: false })).toBeVisible();
  });

  test('6. Method C: Graceful error handling when geolocation permission is denied', async ({
    page,
    context,
  }) => {
    await setupRetailSession(page, { address: null, lat: null, lng: null });
    await page.goto('/portal/retail/business');

    await page.click('button:has-text("Add Location")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Mock geolocation error before clicking
    await page.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (_success, error) => {
        if (error) {
          error({
            code: 1, // PERMISSION_DENIED
            message: 'User denied Geolocation',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      };
    });

    // Click "Use Current Location"
    await modal.locator('button:has-text("Use Current Location")').click();

    // Should display graceful permission denied error message
    await expect(
      modal.locator('text=Location permission was denied'),
    ).toBeVisible();

    // Fallback options remain accessible
    await expect(modal.locator('input[placeholder*="Shop 4"]')).toBeVisible();
    await expect(modal.locator('button:has-text("Choose on Map")')).toBeVisible();
  });

  test('7. Automatic Autofill below map occurs in real time when map search or coordinates change', async ({
    page,
  }) => {
    await setupRetailSession(page, {
      address: null,
      lat: null,
      lng: null,
    });
    await page.goto('/portal/retail/business');

    await page.click('button:has-text("Add Location")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Switch to Map tab
    await modal.locator('button:has-text("Choose on Map")').click();
    await expect(modal.locator('h3:has-text("Choose on Map")')).toBeVisible();

    // Verify the address fields section below map is visible
    await expect(modal.locator('text=Address Details (Autofilled & Editable)')).toBeVisible();
    await expect(modal.locator('input[placeholder*="Central Plaza"]')).toBeVisible();
    await expect(modal.locator('input[placeholder*="Blue Gum Road or George Street"]')).toBeVisible();

    // Search for Bourke Street Melbourne
    const searchInput = modal.locator('input[placeholder*="Search address"]');
    await searchInput.fill('bourke melbourne');
    await modal.locator('button:has-text("Search")').click();

    const suggestionItem = modal.locator('button:has-text("Bourke Street Mall")');
    await expect(suggestionItem).toBeVisible();
    await suggestionItem.click();

    // The fields directly below the map should immediately autofill
    await expect(modal.locator('input[placeholder*="Shop 4"]')).toHaveValue('250 Bourke Street');
    await expect(modal.locator('input[placeholder*="Jesmond"]')).toHaveValue('Melbourne');
    await expect(modal.locator('input[placeholder*="NSW"]')).toHaveValue('VIC');
    await expect(modal.locator('input[placeholder*="2299"]')).toHaveValue('3000');
    await expect(modal.locator('text=Address autofilled from search selection')).toBeVisible();
  });

  test('8. User can manually edit autofilled address fields below map and edits are confirmed', async ({
    page,
  }) => {
    await setupRetailSession(page, {
      address: null,
      lat: null,
      lng: null,
    });
    await page.goto('/portal/retail/business');

    await page.click('button:has-text("Add Location")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    await modal.locator('button:has-text("Choose on Map")').click();

    // Search for Bourke Street Melbourne
    const searchInput = modal.locator('input[placeholder*="Search address"]');
    await searchInput.fill('bourke melbourne');
    await modal.locator('button:has-text("Search")').click();
    await modal.locator('button:has-text("Bourke Street Mall")').click();

    // User edits the Street Address and adds a Building below the map
    const streetInput = modal.locator('input[placeholder*="Shop 4"]');
    await streetInput.fill('Suite 5, 250 Bourke Street');

    const buildingInput = modal.locator('input[placeholder*="Central Plaza"]');
    await buildingInput.fill('Midcity Arcade');

    // Confirm location
    await modal.locator('button:has-text("Confirm Location")').click();

    // Verify the user edits are preserved on the main form
    await expect(modal.locator('input[placeholder*="Shop 4"]')).toHaveValue('Suite 5, 250 Bourke Street');
    await expect(modal.locator('input[placeholder*="Central Plaza"]')).toHaveValue('Midcity Arcade');
    await expect(modal.locator('input[placeholder*="Jesmond"]')).toHaveValue('Melbourne');

    // Save and verify on host page
    await modal.locator('button:has-text("Save Location")').click();
    await expect(modal).not.toBeVisible();

    await expect(page.locator('text=Address:')).toBeVisible();
    await expect(page.getByText('Suite 5, 250 Bourke Street', { exact: false })).toBeVisible();
  });

  test('9. Reverse geocoding network failure displays non-blocking message and allows manual entry', async ({
    page,
  }) => {
    await setupRetailSession(page, {
      address: null,
      lat: null,
      lng: null,
    });

    // Override reverse route to return 500
    await page.route(/\/api\/v1\/locations\/reverse/, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Reverse geocode service unavailable' }),
      });
    });

    await page.goto('/portal/retail/business');

    await page.click('button:has-text("Add Location")');
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    await modal.locator('button:has-text("Choose on Map")').click();

    // Click anywhere on map to trigger reverse geocode which fails with 500
    await modal.locator('.leaflet-container').click({ position: { x: 150, y: 150 } });

    // Wait for the non-blocking error notice
    await expect(
      modal.locator('text=Could not reverse-geocode coordinates. You can enter the address manually below.')
    ).toBeVisible();

    // Verify fields below the map are fully editable and user can type manually
    const streetInput = modal.locator('input[placeholder*="Shop 4"]');
    await streetInput.fill('Manual Entry 42 High Street');
    await expect(streetInput).toHaveValue('Manual Entry 42 High Street');

    // Confirm button remains enabled
    await expect(modal.locator('button:has-text("Confirm Location")')).toBeEnabled();
  });
});
