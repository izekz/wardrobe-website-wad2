import { test, expect } from '@playwright/test'
import { signIn, fixtureProduct } from './helpers.js'

test('E2E 2 - Like, cart, checkout and stock update', async ({ page }) => {
  await signIn(page)
  const product = await fixtureProduct(page)
  const initialStock = product.stock

  await page.goto(`/discover/products/${product.productId}`)
  await expect(page.locator('.disc-detail-copy h1')).toHaveText(product.name)
  await page.getByRole('button', { name: 'Add to Likes' }).click()
  await expect(page.getByText('Added to Likes.')).toBeVisible()

  await page.goto('/discover/liked')
  await expect(page.getByText(product.name)).toBeVisible()

  await page.goto(`/discover/products/${product.productId}`)
  await page.locator('.disc-sizes button').filter({ hasText: 'M' }).click()
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await expect(page.getByText('Added to cart.')).toBeVisible()

  await page.goto('/discover/cart')
  await expect(page.getByText(product.name)).toBeVisible()
  await page.getByRole('link', { name: 'Proceed to checkout' }).click()
  await expect(page).toHaveURL(/\/discover\/checkout/)

  await page.getByLabel('Full name').fill('Test Customer')
  await page.getByLabel('Email').fill('customer.fixture@example.invalid')
  await page.getByLabel('Address').fill('123 Test Avenue')
  await page.getByLabel('Postal code').fill('540123')
  await page.getByLabel('Cardholder name').fill('Test Customer')
  await page.getByLabel('Card number').fill('4111111111111111')
  await page.getByLabel('Expiry').fill('1230')
  await page.getByLabel('CVV').fill('123')
  await page.getByRole('button', { name: /Pay S\$/ }).click()

  await expect(page.getByText('ORDER CONFIRMED')).toBeVisible()
  await expect(page.locator('.checkout-success')).toContainText(/#DR\d{6}/)
  const response = await page.request.get(`/api/catalog/products/${product.productId}`)
  expect(response.ok()).toBeTruthy()
  const updated = (await response.json()).product
  expect(updated.stock).toBe(initialStock - 1)
})
