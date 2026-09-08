import { test, expect } from '@playwright/test';

test.describe('Individual Property Flow', () => {
  test('TEST 1: Individual Property creation hides hierarchy', async ({ page }) => {
    test.setTimeout(45000);
    
    // 1. Login
    console.log('Authenticating provider...');
    const loginRes = await page.request.post('http://localhost:3001/api/v1/auth/login', {
      data: { email: 'provider@jesmond.demo', password: 'Jesmond@Demo2026!' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const authData = await loginRes.json();
    await page.addInitScript((data) => {
      window.localStorage.setItem('access_token', data.access_token);
      window.localStorage.setItem('user', JSON.stringify(data.user));
    }, authData);

    // 2. Open /portal/create
    console.log('Navigating to /portal/create...');
    await page.goto('/portal/create');
    
    // Wait for the form to load
    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    
    // 3. Verify checkbox
    const checkbox = page.locator('input[name="isIndividualProperty"]');
    await expect(checkbox).toBeVisible({ timeout: 5000 });
    
    // 4. Check the checkbox
    console.log('Checking isIndividualProperty...');
    await checkbox.check();
    
    // 5. Fill valid required property data
    console.log('Filling form data...');
    const uniqueSuffix = Date.now().toString();
    await page.fill('input[name="name"]', `Test Individual ${uniqueSuffix}`);
    await page.fill('input[name="address"]', '123 Individual St');
    await page.fill('input[name="postcode"]', '2000');
    await page.fill('textarea[name="description"]', 'This is a test individual property');
    
    // 6. Select State -> City -> Suburb
    console.log('Selecting State -> City -> Suburb...');
    const stateSelect = page.locator('select[name="stateId"]');
    await page.waitForFunction(() => {
      const s = document.querySelector('select[name="stateId"]') as HTMLSelectElement;
      return s && s.options.length > 1;
    }, { timeout: 10000 });
    const stateOpts = await stateSelect.locator('option').all();
    if (stateOpts.length > 1) {
      await stateSelect.selectOption(await stateOpts[1].getAttribute('value') || '');
    }

    const citySelect = page.locator('select[name="cityId"]');
    await expect(citySelect).toBeEnabled({ timeout: 10000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('select[name="cityId"]') as HTMLSelectElement;
      return c && c.options.length > 1;
    }, { timeout: 10000 });
    const cityOpts = await citySelect.locator('option').all();
    if (cityOpts.length > 1) {
      await citySelect.selectOption(await cityOpts[1].getAttribute('value') || '');
    }

    const suburbSelect = page.locator('select[name="suburbId"]');
    await expect(suburbSelect).toBeEnabled({ timeout: 10000 });
    await page.waitForFunction(() => {
      const sub = document.querySelector('select[name="suburbId"]') as HTMLSelectElement;
      return sub && sub.options.length > 1;
    }, { timeout: 10000 });
    const suburbOpts = await suburbSelect.locator('option').all();
    if (suburbOpts.length > 1) {
      await suburbSelect.selectOption(await suburbOpts[1].getAttribute('value') || '');
    }

    // 7. Map click just to be absolutely sure lat/lng is populated if suburb fails
    console.log('Clicking map...');
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });
    console.log('Postcode:', await page.inputValue('input[name="postcode"]'));
    console.log('Suburb ID:', await page.inputValue('select[name="suburbId"]'));
    console.log('Checkbox Checked:', await checkbox.isChecked());
    
    // 8. Submit
    console.log('Submitting form...');
    const createPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/properties') && resp.request().method() === 'POST');
    await page.click('button[type="submit"]');
    
    const resp = await createPromise;
    const status = resp.status();
    console.log('POST Response Status:', status);
    const body = await resp.json();
    if (status >= 400) {
      console.log('POST Response Error Body:', JSON.stringify(body, null, 2));
    }
    expect(status).toBeLessThan(400);
    
    const propertyId = body.id;
    const listingMode = body.listingMode;
    console.log('Created property ID:', propertyId);
    console.log('listingMode value returned by API:', listingMode);
    
    expect(listingMode).toBe('INDIVIDUAL');

    // 9. URL should redirect to portal
    console.log('Waiting for redirect...');
    await page.waitForURL('**/portal');
    
    // 10. Open property detail
    console.log('Navigating to property details...');
    await page.goto(`/portal/properties/${propertyId}`);
    
    // 11. Verify UI
    await expect(page.locator('text="Individual Property"')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text="Hierarchy management is not required for this property."')).toBeVisible();
    await expect(page.locator('text="+ Add Building"')).not.toBeVisible();
    
    console.log('TEST 1 Passed');
  });

  test('TEST 2: Multi-unit regression', async ({ page }) => {
    test.setTimeout(45000);
    
    const loginRes = await page.request.post('http://localhost:3001/api/v1/auth/login', {
      data: { email: 'provider@jesmond.demo', password: 'Jesmond@Demo2026!' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const authData = await loginRes.json();
    await page.addInitScript((data) => {
      window.localStorage.setItem('access_token', data.access_token);
      window.localStorage.setItem('user', JSON.stringify(data.user));
    }, authData);

    await page.goto('/portal/create');
    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    
    const checkbox = page.locator('input[name="isIndividualProperty"]');
    await expect(checkbox).not.toBeChecked(); // leave unchecked
    
    const uniqueSuffix = Date.now().toString();
    await page.fill('input[name="name"]', `Test Multi ${uniqueSuffix}`);
    await page.fill('input[name="address"]', '456 Multi St');
    await page.fill('input[name="postcode"]', '2000');
    await page.fill('textarea[name="description"]', 'This is a test multi property');
    
    const stateSelect = page.locator('select[name="stateId"]');
    await page.waitForFunction(() => {
      const s = document.querySelector('select[name="stateId"]') as HTMLSelectElement;
      return s && s.options.length > 1;
    }, { timeout: 10000 });
    const stateOpts = await stateSelect.locator('option').all();
    if (stateOpts.length > 1) {
      await stateSelect.selectOption(await stateOpts[1].getAttribute('value') || '');
    }

    const citySelect = page.locator('select[name="cityId"]');
    await expect(citySelect).toBeEnabled({ timeout: 10000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('select[name="cityId"]') as HTMLSelectElement;
      return c && c.options.length > 1;
    }, { timeout: 10000 });
    const cityOpts = await citySelect.locator('option').all();
    if (cityOpts.length > 1) {
      await citySelect.selectOption(await cityOpts[1].getAttribute('value') || '');
    }

    const suburbSelect = page.locator('select[name="suburbId"]');
    await expect(suburbSelect).toBeEnabled({ timeout: 10000 });
    await page.waitForFunction(() => {
      const sub = document.querySelector('select[name="suburbId"]') as HTMLSelectElement;
      return sub && sub.options.length > 1;
    }, { timeout: 10000 });
    const suburbOpts = await suburbSelect.locator('option').all();
    if (suburbOpts.length > 1) {
      await suburbSelect.selectOption(await suburbOpts[1].getAttribute('value') || '');
    }
    
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });
    await mapContainer.click();

    const createPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/properties') && resp.request().method() === 'POST');
    await page.click('button[type="submit"]');
    
    const resp = await createPromise;
    const body = await resp.json();
    console.log('Created Multi Property API Response:', JSON.stringify(body, null, 2));
    expect(resp.status()).toBeLessThan(400);
    expect(body.listingMode).toBe('MULTI_UNIT');
    
    console.log('TEST 2 Passed - Multi unit created successfully.');
  });
});
