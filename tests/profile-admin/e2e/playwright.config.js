import { defineConfig, devices } from '@playwright/test'
import {
  projectRoot, testBaseURL, reportFolder, resultsFolder,
} from './test-settings.js'

export default defineConfig({
  testDir: '.',
  testMatch: ['admin-login.spec.ts', 'admin-logout.spec.js'],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: reportFolder, open: 'never' }],
  ],
  outputDir: resultsFolder,
  use: {
    baseURL: testBaseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    cwd: projectRoot,
    // Replace the POSIX shell so Playwright waits for Node's cleanup to finish.
    command: process.platform === 'win32'
      ? 'node tests/profile-admin/e2e/start-test-app.mjs'
      : 'exec node tests/profile-admin/e2e/start-test-app.mjs',
    url: `${testBaseURL}/api/health`,
    timeout: 180000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 20000 },
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
