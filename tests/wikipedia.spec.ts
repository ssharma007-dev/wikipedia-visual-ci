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

// WIKI-1: the portal "Search" button uses the brand teal color (color-brand-primary,
// #0E7C7B) for background and border, on desktop and phone, while the article header's
// (secondary) search button keeps its current look untouched.
test('Portal Search button is brand teal, article header search button is unchanged (WIKI-1)', async ({ page }) => {
  await page.goto(BASE);

  const portalButton = page.locator('.search-container .pure-form button');
  const portalBg = await portalButton.evaluate((el) => getComputedStyle(el).backgroundColor);
  const portalBorder = await portalButton.evaluate((el) => getComputedStyle(el).borderColor);
  expect(portalBg).toBe('rgb(14, 124, 123)'); // color-brand-primary
  expect(portalBorder).toBe('rgb(14, 124, 123)');

  await page.setViewportSize({ width: 384, height: 854 });
  await page.goto(BASE);
  const portalBgPhone = await portalButton.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(portalBgPhone).toBe('rgb(14, 124, 123)');

  await page.goto(`${BASE}/wiki/Functional_testing`);
  const articleButton = page.locator('#searchform .cdx-search-input__end-button');
  const articleBg = await articleButton.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(articleBg).not.toBe('rgb(14, 124, 123)');
});

test('Search for "functional testing"', async ({ page, eyes }) => {
  await page.goto(BASE);

  await page.fill('#searchInput', 'functional testing');
  await page.click('button[type="submit"]');

  await eyes.check('Functional testing page', { fully: true });
});

// WIKI-15: the "Create account" header link is renamed to "Join Wikipedia" on article
// pages, on both desktop and phone. "Donate" and "Log in" must stay unchanged.
test('Article header shows Donate, Join Wikipedia and Log in links (WIKI-15)', async ({ page, eyes }) => {
  await page.goto(`${BASE}/wiki/Functional_testing`);

  await expect(page.locator('#pt-createaccount-2 a span')).toHaveText('Join Wikipedia');
  await expect(page.locator('#pt-createaccount a span').last()).toHaveText('Join Wikipedia');
  await expect(page.locator('#pt-sitesupport-2 a span')).toHaveText('Donate');
  await expect(page.locator('#pt-login-2 a span')).toHaveText('Log in');

  await eyes.check('Article header links', { region: '#p-vector-user-menu-overflow', fully: false });
});

// WIKI-16: the "Donate" header link is bold (font-weight 700) on article pages, on both
// desktop and phone, while its color and every other header link stay unchanged.
test('Donate header link is bold, other header links are not (WIKI-16)', async ({ page }) => {
  await page.goto(`${BASE}/wiki/Functional_testing`);

  const donateWeight = await page.locator('#pt-sitesupport-2 a').evaluate(
    (el) => getComputedStyle(el).fontWeight
  );
  expect(Number(donateWeight)).toBeGreaterThanOrEqual(700);

  const joinWeight = await page.locator('#pt-createaccount-2 a').evaluate(
    (el) => getComputedStyle(el).fontWeight
  );
  const loginWeight = await page.locator('#pt-login-2 a').evaluate(
    (el) => getComputedStyle(el).fontWeight
  );
  expect(Number(joinWeight)).toBeLessThan(700);
  expect(Number(loginWeight)).toBeLessThan(700);

  const donateColor = await page.locator('#pt-sitesupport-2 a span').evaluate(
    (el) => getComputedStyle(el).color
  );
  expect(donateColor).toBe('rgb(51, 102, 204)'); // color-progressive
});
