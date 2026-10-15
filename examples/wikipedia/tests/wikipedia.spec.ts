import { test } from '@applitools/eyes-playwright/fixture';

const BASE = process.env.SITE_URL ?? 'http://localhost:3001/wikipedia';

// Three visual tests cover the demo site. Each eyes.check() compares the whole page with its
// baseline on every device in playwright.config.ts, so no textual assertions are needed.

test('Portal page', async ({ page, eyes }) => {
  await page.goto(BASE);
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
