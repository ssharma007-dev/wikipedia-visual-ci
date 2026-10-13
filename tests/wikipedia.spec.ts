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

// WIKI-8: on phone the portal search input and Search button are both 48px tall and
// aligned, with the button directly to the right of the input. Desktop/tablet must keep
// the design system's default 44px (the ticket's "Must not change" list).
test('Portal search bar is 48px tall and aligned on phone (WIKI-8)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE);

  const input = page.locator('#searchInput');
  const button = page.locator('.search-container .pure-form button');

  const inputBox = await input.boundingBox();
  const buttonBox = await button.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();

  expect(inputBox!.height).toBeCloseTo(48, 0);
  expect(buttonBox!.height).toBeCloseTo(48, 0);
  expect(inputBox!.y).toBeCloseTo(buttonBox!.y, 0);
  expect(buttonBox!.x).toBeCloseTo(inputBox!.x + inputBox!.width, 0);

  await page.setViewportSize({ width: 1200, height: 800 });
  const inputDesktopBox = await input.boundingBox();
  const buttonDesktopBox = await button.boundingBox();
  expect(inputDesktopBox!.height).toBeCloseTo(44, 0);
  expect(buttonDesktopBox!.height).toBeCloseTo(44, 0);
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
