import { defineConfig } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for MyndPrompts Electron E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e/specs',

  /* Maximum time one test can run for */
  timeout: 60000,

  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests - Electron tests should run sequentially */
  workers: 1,

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'tests/e2e/reports/html' }],
    ['json', { outputFile: 'tests/e2e/reports/results.json' }],
    ['list'],
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Maximum time each action such as `click()` can take */
    actionTimeout: 15000,

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts',
    },
  ],

  /* Output folder for test artifacts */
  outputDir: 'tests/e2e/reports/artifacts',

  /* Global setup */
  globalSetup: path.join(__dirname, 'tests/e2e/helpers/global-setup.ts'),

  /* Global teardown */
  globalTeardown: path.join(__dirname, 'tests/e2e/helpers/global-teardown.ts'),
});
