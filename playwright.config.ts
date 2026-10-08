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
      appName: 'Wikipedia - Liran - 8th October',
      // Differences must not fail the run: the review agent decides. On CI the fixture
      // defaults to 'afterAll', i.e. getAllTestResults(true), which throws on diffs.
      failTestsOnDiff: false,
      // Eyes branching (set by CI): main runs use '<owner>/<repo>/main'; a PR runs on
      // '<owner>/<repo>/<pr-branch>' with '<owner>/<repo>/main' as its parent, so it inherits
      // main's baseline until its own changes are saved.
      ...(process.env.EYES_BRANCH_NAME ? { branchName: process.env.EYES_BRANCH_NAME } : {}),
      ...(process.env.EYES_PARENT_BRANCH_NAME ? { parentBranchName: process.env.EYES_PARENT_BRANCH_NAME } : {}),
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
