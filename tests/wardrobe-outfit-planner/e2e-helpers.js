
import { expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export const itemPhoto = fileURLToPath(new URL('../../src/assets/images/survey/minimalist.jpg', import.meta.url))

export function requireLocalTestApp(test) {
  test.skip(process.env.WOP_E2E_TEST_RUN !== '1', 'Use this test folder\'s pnpm test command.')
  test.skip(({ baseURL }) => baseURL !== 'http://127.0.0.1:4186', 'The test requires its isolated local app and database.')
}

export async function login(page, email) {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password: 'Local-fixture-password-2026', remember: false },
  })
  expect(response.status()).toBe(200)
}
