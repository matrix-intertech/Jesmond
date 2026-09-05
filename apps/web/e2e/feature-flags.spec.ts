import { test, expect } from '@playwright/test';
import { prisma } from '@jesmond/db';

test.describe('Feature Flags functionality', () => {
  // Ensure the flags are reset to enabled after tests
  test.afterAll(async () => {
    await prisma.featureFlag.upsert({
      where: { key: 'STATES' },
      update: { enabled: true },
      create: { key: 'STATES', enabled: true }
    });
    await prisma.featureFlag.upsert({
      where: { key: 'UNIVERSITIES' },
      update: { enabled: true },
      create: { key: 'UNIVERSITIES', enabled: true }
    });
    await prisma.$disconnect();
  });

  test('States and Universities pages load when enabled', async ({ page }) => {
    await prisma.featureFlag.upsert({
      where: { key: 'STATES' },
      update: { enabled: true },
      create: { key: 'STATES', enabled: true }
    });
    await prisma.featureFlag.upsert({
      where: { key: 'UNIVERSITIES' },
      update: { enabled: true },
      create: { key: 'UNIVERSITIES', enabled: true }
    });

    // Check States page
    const responseStates = await page.goto('http://localhost:3000/states');
    expect(responseStates?.ok()).toBeTruthy();
    const statesHeading = await page.locator('h1').textContent();
    expect(statesHeading).not.toContain('Coming Soon');

    // Check Universities page
    const responseUni = await page.goto('http://localhost:3000/universities');
    expect(responseUni?.ok()).toBeTruthy();
    const uniHeading = await page.locator('h1').textContent();
    expect(uniHeading).not.toContain('Coming Soon');
  });

  test('States page shows Coming Soon when disabled while Universities is normal', async ({ page }) => {
    await prisma.featureFlag.upsert({
      where: { key: 'STATES' },
      update: { enabled: false },
      create: { key: 'STATES', enabled: false }
    });
    await prisma.featureFlag.upsert({
      where: { key: 'UNIVERSITIES' },
      update: { enabled: true },
      create: { key: 'UNIVERSITIES', enabled: true }
    });

    // States should be Coming Soon
    await page.goto('http://localhost:3000/states');
    const statesHeading = await page.locator('h1').textContent();
    expect(statesHeading).toContain('Coming Soon');

    // Universities should be normal
    await page.goto('http://localhost:3000/universities');
    const uniHeading = await page.locator('h1').textContent();
    expect(uniHeading).not.toContain('Coming Soon');
  });

  test('Universities page shows Coming Soon when disabled while States is normal', async ({ page }) => {
    await prisma.featureFlag.upsert({
      where: { key: 'STATES' },
      update: { enabled: true },
      create: { key: 'STATES', enabled: true }
    });
    await prisma.featureFlag.upsert({
      where: { key: 'UNIVERSITIES' },
      update: { enabled: false },
      create: { key: 'UNIVERSITIES', enabled: false }
    });

    // States should be normal
    await page.goto('http://localhost:3000/states');
    const statesHeading = await page.locator('h1').textContent();
    expect(statesHeading).not.toContain('Coming Soon');

    // Universities should be Coming Soon
    await page.goto('http://localhost:3000/universities');
    const uniHeading = await page.locator('h1').textContent();
    expect(uniHeading).toContain('Coming Soon');
  });

  test('Both pages show Coming Soon when disabled', async ({ page }) => {
    await prisma.featureFlag.upsert({
      where: { key: 'STATES' },
      update: { enabled: false },
      create: { key: 'STATES', enabled: false }
    });
    await prisma.featureFlag.upsert({
      where: { key: 'UNIVERSITIES' },
      update: { enabled: false },
      create: { key: 'UNIVERSITIES', enabled: false }
    });

    // States should be Coming Soon
    await page.goto('http://localhost:3000/states');
    const statesHeading = await page.locator('h1').textContent();
    expect(statesHeading).toContain('Coming Soon');

    // Universities should be Coming Soon
    await page.goto('http://localhost:3000/universities');
    const uniHeading = await page.locator('h1').textContent();
    expect(uniHeading).toContain('Coming Soon');
  });
});
