import { defineConfig, devices } from '@playwright/test'

// Like Business tests, this configuration starts an independent site and DB.
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { outputFolder: '../../playwright-report-customer-javier', open: 'never' }]],
  outputDir: '../../test-results-customer-javier',
  use: {
    baseURL: 'http://127.0.0.1:5387',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tests/customer-javier/test-environment.mjs',
    cwd: '../..',
    url: 'http://127.0.0.1:5387/api/health',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
