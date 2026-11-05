import { defineConfig, devices } from '@playwright/test'

const testDatabase = 'mongodb://127.0.0.1:27099/wardrobe_business_e2e'

export default defineConfig({
  testDir: '.',
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: '../../../playwright-report-business', open: 'never' }]],
  outputDir: '../../../test-results-business',
  use: { baseURL: 'http://127.0.0.1:5199', ...devices['Desktop Chrome'] },
  webServer: [
    { command: 'node tests/business/e2e/start-test-database.mjs', cwd: '../../..', port: 27099, reuseExistingServer: false },
    { command: 'node server.js', cwd: '../../../server', port: 3199, reuseExistingServer: false,
      env: { PORT: '3199', DB: testDatabase, MONGODB_URI: testDatabase, CLIENT_ORIGIN: 'http://127.0.0.1:5199' } },
    { command: 'pnpm exec vite --config tests/business/e2e/vite.config.js', cwd: '../../..', port: 5199, reuseExistingServer: false },
  ],
})
