import { expect } from '@playwright/test'

const origin = 'http://127.0.0.1:5299'
export const testPassword = 'Testing-pass-123'
export const smallPhoto = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')

export async function registerAccount(request, role) {
  const email = `stylefeed-${role}-${crypto.randomUUID()}@example.test`
  const response = await request.post('/api/auth/register', {
    headers: { Origin: origin },
    data: { name: role === 'business' ? 'Javier Test Boutique' : 'Alex Test', email,
      password: testPassword, confirmPassword: testPassword, role },
  })
  expect(response.ok(), `Register ${role}: ${response.status()} ${await response.text()}`).toBeTruthy()
  if (role === 'business') {
    const profile = await request.put('/api/business/profile', {
      headers: { Origin: origin },
      data: { businessName: 'Javier Test Boutique', description: 'Test clothing shop',
        styles: ['Classic', 'Minimalist'], contact: email },
    })
    expect(profile.ok(), `Save business profile: ${profile.status()} ${await profile.text()}`).toBeTruthy()
  }
  return { email, password: testPassword }
}

export async function signIn(page, account) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
}

export async function addBusinessProduct(request, name = 'Javier Demo Jacket') {
  const response = await request.post('/api/business/products', {
    headers: { Origin: origin },
    data: { name, price: 35, style: 'Classic', category: 'Jackets',
      colours: ['Black'], material: 'Cotton', occasions: ['University'],
      sizeStock: { M: 4 }, description: 'Smart-casual presentation jacket.',
      photo: `data:image/png;base64,${smallPhoto.toString('base64')}` },
  })
  expect(response.ok(), `Create product: ${response.status()} ${await response.text()}`).toBeTruthy()
  return (await response.json()).product
}
