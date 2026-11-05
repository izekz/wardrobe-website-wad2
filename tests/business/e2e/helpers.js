import { expect } from '@playwright/test'

export const smallPhoto = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
const password = 'Testing-pass-123'

// Makes a new business account with a profile, then logs in through the real login page.
export async function logInAsNewBusiness(page, request) {
  const email = `shop-${Date.now()}@example.test`
  const headers = { Origin: 'http://127.0.0.1:5199' }
  const registered = await request.post('/api/auth/register', { headers,
    data: { name: 'Test Shop', email, password, confirmPassword: password, role: 'business' } })
  expect(registered.ok()).toBeTruthy()
  const profile = await request.put('/api/business/profile', { headers,
    data: { businessName: 'Test Shop', description: 'Clothing shop', styles: ['Minimalist'], contact: email } })
  expect(profile.ok()).toBeTruthy()

  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/business/)
}
