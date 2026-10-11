import { test } from '@applitools/eyes-playwright/fixture';

const BASE = process.env.SITE_URL ?? 'http://localhost:3001/wikipedia';

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

test('Article header shows Donate, Create account and Log in links', async ({ page, eyes }) => {
  await page.goto(`${BASE}/wiki/Functional_testing`);

  await eyes.check('Article header links', { region: '#p-vector-user-menu-overflow', fully: false });
});
