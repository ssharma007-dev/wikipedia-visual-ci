import { test, expect } from '@applitools/eyes-playwright/fixture';

const BASE = process.env.SITE_URL ?? 'http://localhost:3001/wikipedia';

// Three visual tests cover the demo site. Each eyes.check() compares the whole page with its
// baseline on every device in playwright.config.ts, so no textual assertions are needed.

test('Portal page', async ({ page, eyes }) => {
  await page.goto(BASE);
  await eyes.check('Portal', { fully: true });
});

// WIKI-37: the Search button turns red; everything else on the portal (search box, button
// size/position, logo, tagline, language links, app badges) must stay put. A region checkpoint
// on the search bar gives a tight, stable diff for the color change; the full-page "Portal page"
// check above still covers the rest of the "Must not change" list.
test('WIKI-37: Portal search button is red', async ({ page, eyes }) => {
  await page.goto(BASE);
  await eyes.check('Portal search bar', { region: '#search-form', fully: true });

  const button = page.locator('#search-form button[type="submit"]');
  const input = page.locator('#searchInput');

  const backgroundColor = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(backgroundColor).toBe('rgb(221, 51, 51)'); // #D33

  const buttonBox = await button.boundingBox();
  const inputBox = await input.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  // Must-not-change: button stays the same height as the search box and keeps a real tap target.
  expect(buttonBox.height).toBe(inputBox.height);
  expect(buttonBox.height).toBeGreaterThanOrEqual(44);
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
