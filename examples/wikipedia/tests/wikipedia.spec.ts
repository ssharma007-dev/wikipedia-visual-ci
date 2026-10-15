import { test, expect } from '@applitools/eyes-playwright/fixture';

const BASE = process.env.SITE_URL ?? 'http://localhost:3001/wikipedia';

// Three visual tests cover the demo site. Each eyes.check() compares the whole page with its
// baseline on every device in playwright.config.ts, so no textual assertions are needed.

test('Portal page', async ({ page, eyes }) => {
  await page.goto(BASE);
  await eyes.check('Portal', { fully: true });
});

// WIKI-36: the "Download on the App Store" badge is removed from the portal's Download
// Wikipedia box. The Google Play badge and the box's heading text must stay (ticket's
// "Must not change" list), so assert both sides rather than relying on the screenshot alone.
test('Portal page — App Store badge removed, Google Play badge kept', async ({ page, eyes }) => {
  await page.goto(BASE);
  await expect(page.locator('.app-badge-ios')).toBeHidden();
  await expect(page.locator('.app-badge-android')).toBeVisible();
  await expect(page.locator('.app-badges')).toContainText('Download Wikipedia for Android or iOS');
  await eyes.check('Download Wikipedia box', { region: '.footer-sidebar.app-badges' });
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
