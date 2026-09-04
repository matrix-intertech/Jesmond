import { test, expect } from '@playwright/test';

test.describe('Location Dependent Dropdown Flow (State → City → Suburb)', () => {
  test.beforeEach(async ({ page, request }) => {
    // Authenticate provider via API and inject token into localStorage
    const loginRes = await request.post('http://localhost:3001/api/v1/auth/login', {
      data: {
        email: 'provider@jesmond.demo',
        password: 'Jesmond@Demo2026!',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const authData = await loginRes.json();

    await page.addInitScript((data) => {
      window.localStorage.setItem('access_token', data.access_token);
      window.localStorage.setItem('user', JSON.stringify(data.user));
    }, authData);

    // Navigate directly to /portal/create
    await page.goto('/portal/create');
    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
  });

  test('Dependent dropdowns follow State → City → Suburb hierarchy with proper disabled and reset states', async ({ page }) => {
    const stateSelect = page.locator('select[name="stateId"]');
    const citySelect = page.locator('select[name="cityId"]');
    const suburbSelect = page.locator('select[name="suburbId"]');
    const postcodeInput = page.locator('input[name="postcode"]');

    // Step 1: Initial state verification
    await expect(stateSelect).toBeVisible();
    await expect(citySelect).toBeVisible();
    await expect(suburbSelect).toBeVisible();

    // City and Suburb must be disabled before State selection
    await expect(citySelect).toBeDisabled();
    await expect(suburbSelect).toBeDisabled();
    await expect(citySelect).toContainText('Select a State first');
    await expect(suburbSelect).toContainText('Select a City first');

    // Wait for states to load
    await page.waitForFunction(() => {
      const select = document.querySelector('select[name="stateId"]') as HTMLSelectElement;
      return select && select.options.length > 1;
    }, { timeout: 10000 });

    // Step 2: Select State (Victoria - VIC)
    const stateOptions = await stateSelect.locator('option').all();
    let vicValue = '';
    for (const opt of stateOptions) {
      const text = await opt.innerText();
      if (text.includes('Victoria') || text.includes('VIC')) {
        vicValue = (await opt.getAttribute('value')) || '';
        break;
      }
    }
    expect(vicValue).not.toBe('');
    await stateSelect.selectOption(vicValue);

    // Step 3: City dropdown should now be enabled and populated
    await expect(citySelect).toBeEnabled({ timeout: 10000 });
    await page.waitForFunction(() => {
      const select = document.querySelector('select[name="cityId"]') as HTMLSelectElement;
      return select && select.options.length > 1;
    }, { timeout: 10000 });

    // Suburb should still remain disabled until City is selected
    await expect(suburbSelect).toBeDisabled();
    await expect(suburbSelect).toContainText('Select a City first');

    // Step 4: Select City (Melbourne)
    const cityOptions = await citySelect.locator('option').all();
    let melbValue = '';
    for (const opt of cityOptions) {
      const text = await opt.innerText();
      if (text.includes('Melbourne')) {
        melbValue = (await opt.getAttribute('value')) || '';
        break;
      }
    }
    expect(melbValue).not.toBe('');
    await citySelect.selectOption(melbValue);

    // Step 5: Suburb dropdown should now be enabled and populated
    await expect(suburbSelect).toBeEnabled({ timeout: 10000 });
    await page.waitForFunction(() => {
      const select = document.querySelector('select[name="suburbId"]') as HTMLSelectElement;
      return select && select.options.length > 1;
    }, { timeout: 10000 });

    // Step 6: Select Suburb (Melbourne CBD or Clayton)
    const suburbOptions = await suburbSelect.locator('option').all();
    expect(suburbOptions.length).toBeGreaterThan(1);
    const selectedSuburbValue = (await suburbOptions[1].getAttribute('value')) || '';
    await suburbSelect.selectOption(selectedSuburbValue);

    // Postcode should auto-populate
    await expect(postcodeInput).not.toHaveValue('');

    // Step 7: Test Reset - Change State must clear City and Suburb
    // Select a different state (or NSW)
    let nswValue = '';
    for (const opt of stateOptions) {
      const text = await opt.innerText();
      if (text.includes('New South Wales') || text.includes('NSW')) {
        nswValue = (await opt.getAttribute('value')) || '';
        break;
      }
    }
    if (nswValue) {
      await stateSelect.selectOption(nswValue);

      // Suburb must be cleared and disabled
      await expect(suburbSelect).toBeDisabled();
      await expect(suburbSelect).toHaveValue('');
      await expect(postcodeInput).toHaveValue('');

      // City should reload for NSW (Sydney)
      await expect(citySelect).toBeEnabled({ timeout: 10000 });
      await page.waitForFunction(() => {
        const select = document.querySelector('select[name="cityId"]') as HTMLSelectElement;
        return select && select.options.length > 1;
      }, { timeout: 10000 });

      // Select Sydney
      const nswCityOptions = await citySelect.locator('option').all();
      let sydneyVal = '';
      for (const opt of nswCityOptions) {
        const text = await opt.innerText();
        if (text.includes('Sydney')) {
          sydneyVal = (await opt.getAttribute('value')) || '';
          break;
        }
      }
      if (sydneyVal) {
        await citySelect.selectOption(sydneyVal);
        await expect(suburbSelect).toBeEnabled({ timeout: 10000 });

        // Change City to empty must clear Suburb
        await citySelect.selectOption('');
        await expect(suburbSelect).toBeDisabled();
        await expect(suburbSelect).toHaveValue('');
      }
    }
  });
});
