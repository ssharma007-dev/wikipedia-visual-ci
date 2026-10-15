import { test, expect } from '@applitools/eyes-playwright/fixture';

const BASE = process.env.SITE_URL ?? 'http://localhost:3001/wikipedia';

// Visual tests covering the demo site. Each eyes.check() compares the page (or a named region)
// with its baseline on every device in playwright.config.ts.

test('Portal page', async ({ page, eyes }) => {
  await page.goto(BASE);
  await eyes.check('Portal', { fully: true });
});

test('Remove App Store badge from the portal (WIKI-34)', async ({ page, eyes }) => {
  await page.goto(BASE);
  const appBadges = page.locator('.app-badges');
  await expect(appBadges.locator('.app-badge-ios')).toBeHidden();
  await expect(appBadges.locator('.app-badge-android')).toBeVisible();
  await expect(appBadges.locator('strong')).toHaveText(/Download Wikipedia for Android or iOS/);
  await eyes.check('Portal download box', { region: '.app-badges', fully: true });
});

test('Search for "functional testing"', async ({ page, eyes }) => {
  await page.goto(BASE);
  await page.fill('#searchInput', 'functional testing');
  await page.click('button[type="submit"]');
  await eyes.check('Functional testing page', { fully: true });
});

test('Search for an article that does not exist', async ({ page, eyes }) => {
  await page.goto(BASE);
  await page.fill('#searchInput', 'blah blah');
  await page.click('button[type="submit"]');
  await eyes.check('Not found page', { fully: true });
});
