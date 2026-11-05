import { expect } from '@playwright/test'

const email = 'customer.fixture@example.invalid'
const password = 'Local-customer-fixture-2026'

export async function signIn(page) {
  await page.goto('/login')
  const response = await page.request.post('/api/auth/login', {
    data: { email, password, remember: false },
    headers: { Origin: new URL(page.url()).origin },
  })
  expect(response.status()).toBe(200)
  const session = await page.request.get('/api/auth/session')
  expect((await session.json()).user?.role).toBe('consumer')
}

export async function fixtureProduct(page) {
  const response = await page.request.get('/api/catalog/products?view=all')
  expect(response.ok()).toBeTruthy()
  const products = (await response.json()).products
  const product = products.find(p => p.name === 'Javier Test Jacket')
  expect(product, 'Expected test product seeded in temporary DB').toBeTruthy()
  return product
}
