import { test, expect } from '@applitools/eyes-playwright/fixture';

const BASE = process.env.SITE_URL ?? 'http://localhost:3001/wikipedia';

// Three visual tests cover the demo site. Each eyes.check() compares the whole page with its
// baseline on every device in playwright.config.ts, so no textual assertions are needed.

test('Portal page', async ({ page, eyes }) => {
  await page.goto(BASE);
  // WIKI-44: the App Store badge is removed; Google Play and the surrounding text stay.
  await expect(page.locator('.app-badge-ios')).toBeHidden();
  await expect(page.locator('.app-badge-android')).toBeVisible();
  await expect(page.locator('.app-badges')).toContainText('Download Wikipedia for Android or iOS');
  await eyes.check('Portal', { fully: true });
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

test('Search button stays inside the viewport on phone', async ({ page }) => {
  // Regression test for a bug found while fixing WIKI-44: on the Galaxy S25 Ultra
  // (384px CSS width) `#search-form button[type="submit"]{margin-right:-28px}` pushed
  // the button 18px past the right edge, breaking design-system invariants #1 (every
  // interactive element fully visible) and #4 (no horizontal scrolling on any breakpoint).
  await page.setViewportSize({ width: 384, height: 854 });
  await page.goto(BASE);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  const buttonBox = await page.locator('#search-form button[type="submit"]').boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(384);
});
