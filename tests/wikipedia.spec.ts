import { test, expect } from '@applitools/eyes-playwright/fixture';

const BASE = process.env.SITE_URL ?? 'http://localhost:3001/wikipedia';

test('Portal page', async ({ page, eyes }) => {
  await page.goto(BASE);
  await eyes.check('Portal', { fully: true });
});

// WIKI-12 regression: on phone the search button must stay fully visible (design system
// invariants 1 and 4) instead of being pushed past the viewport edge.
test('Search button is fully visible on phone (WIKI-12)', async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 854 });
  await page.goto(BASE);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);

  const button = page.locator('.search-container .pure-form button');
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
});

test('Search for "functional testing"', async ({ page, eyes }) => {
  await page.goto(BASE);

  await page.fill('#searchInput', 'functional testing');
  await page.click('button[type="submit"]');

  await eyes.check('Functional testing page', { fully: true });
});

test('Article header shows Donate, Create account and Log in links', async ({ page, eyes }) => {
  await page.goto(`${BASE}/wiki/Functional_testing`);

  await eyes.check('Article header links', { region: '#p-vector-user-menu-overflow', fully: false });
});
