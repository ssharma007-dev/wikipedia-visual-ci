import { EyesFixture } from '@applitools/eyes-playwright/fixture';
import { defineConfig, devices } from '@playwright/test';

// In CI the workflow sets APPLITOOLS_BATCH_ID / APPLITOOLS_BATCH_NAME so every
// PR run lands in one Eyes batch the review agent can find.
export default defineConfig<EyesFixture>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }], ['@applitools/eyes-playwright/reporter']],
  use: {
    eyesConfig: {
      appName: 'Wikipedia CI demo',
      matchLevel: 'Strict',
      type: 'ufg',
      browsersInfo: [
        { name: 'chrome', width: 1200, height: 800 },
        { chromeEmulationInfo: { deviceName: 'Galaxy S25 Ultra', screenOrientation: 'portrait' } },
      ],
    },
    trace: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
