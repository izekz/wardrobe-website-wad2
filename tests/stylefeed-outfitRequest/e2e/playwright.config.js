import { defineConfig, devices } from '@playwright/test'

const mongoUrl = 'mongodb://127.0.0.1:27129/wardrobe_stylefeed_outfitrequest_e2e?replicaSet=rsStyleOutfit'
export default defineConfig({
  testDir: '.',
  testMatch: ['outfit-request.spec.js', 'style-feed-boost.spec.js'],
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: '../../../playwright-report-stylefeed-outfitRequest', open: 'never' }]],
  outputDir: '../../../test-results-stylefeed-outfitRequest',
  use: { baseURL: 'http://127.0.0.1:5299', ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  webServer: [
    { command: 'node tests/stylefeed-outfitRequest/e2e/start-test-database.mjs', cwd: '../../..',
      url: 'http://127.0.0.1:27128', timeout: 180_000, reuseExistingServer: false },
    { command: 'node server.js', cwd: '../../../server', port: 3299, timeout: 60_000, reuseExistingServer: false,
      env: { PORT: '3299', DB: mongoUrl, MONGODB_URI: mongoUrl,
        CLIENT_ORIGIN: 'http://127.0.0.1:5299', NODE_ENV: 'test' } },
    { command: 'pnpm exec vite --config tests/stylefeed-outfitRequest/e2e/vite.config.js', cwd: '../../..',
      port: 5299, timeout: 60_000, reuseExistingServer: false },
  ],
})
