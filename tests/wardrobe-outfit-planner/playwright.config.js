
import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'

// Required by the specs: accidental runs outside this local harness are skipped.
process.env.WOP_E2E_TEST_RUN = '1'

export function playwrightConfig(testDir, outputName) {
  return defineConfig({
    testDir,
    testMatch: '**/tests/*.spec.js',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 60000,
    reporter: 'list',
    // Playwright's small runtime files go to the OS temp folder, not the project.
    outputDir: path.join(os.tmpdir(), 'dripped-wop-playwright', outputName),
    use: {
      baseURL: 'http://127.0.0.1:4186',
      viewport: { width: 1440, height: 1050 },
      channel: 'msedge',
      trace: 'off',
      screenshot: 'off',
      video: 'off',
    },
    webServer: {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      command: 'node tests/wardrobe-outfit-planner/e2e-server.cjs',
      url: 'http://127.0.0.1:4186/__test/ready',
      reuseExistingServer: false,
      timeout: 180000,
    },
  })
}

export default playwrightConfig(fileURLToPath(new URL('.', import.meta.url)), 'all')
