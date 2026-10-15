import { EyesFixture } from '@applitools/eyes-playwright/fixture';
import { defineConfig, devices } from '@playwright/test';

// In CI the workflow sets APPLITOOLS_BATCH_ID / APPLITOOLS_BATCH_NAME so every
// PR run lands in one Eyes batch the review agent can find.
export default defineConfig<EyesFixture>({
  // Your test cases. In this repository: the Wikipedia example app.
  testDir: './examples/wikipedia/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }], ['@applitools/eyes-playwright/reporter']],
  use: {
    eyesConfig: {
      appName: 'Wikipedia - Eyes demo agent',
      // Differences must not fail the run: the review agent decides. On CI the fixture
      // defaults to 'afterAll', i.e. getAllTestResults(true), which throws on diffs.
      failTestsOnDiff: false,
      // Agent runs set EYES_SAVE_NEW_TESTS=false so tests the agent writes wait for a person to save them.
      saveNewTests: process.env.EYES_SAVE_NEW_TESTS !== 'false',
      // Eyes branching (set by CI): main runs use '<owner>/<repo>/main'; a PR runs on
      // '<owner>/<repo>/<pr-branch>' with '<owner>/<repo>/main' as its parent, so it inherits
      // main's baseline until its own changes are saved.
      ...(process.env.EYES_BRANCH_NAME ? { branchName: process.env.EYES_BRANCH_NAME } : {}),
      ...(process.env.EYES_PARENT_BRANCH_NAME ? { parentBranchName: process.env.EYES_PARENT_BRANCH_NAME } : {}),
      // PRs always compare against main's baseline, even if the PR branch saved one earlier.
      ...(process.env.EYES_PARENT_BRANCH_NAME ? { compareWithParentBranch: true } : {}),
      matchLevel: 'Strict',
      type: 'ufg',
      // Devices: the ticket's "Test on below devices:" list when it has one ( set by CI as EYES_DEVICES,
      // see scripts/devices.mjs ), otherwise these defaults.
      browsersInfo: process.env.EYES_DEVICES ? JSON.parse(process.env.EYES_DEVICES) : [
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
