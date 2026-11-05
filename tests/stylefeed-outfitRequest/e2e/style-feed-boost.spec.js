import { test, expect } from '@playwright/test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerAccount, signIn, addBusinessProduct } from './helpers.js'

// E2E TEST 2: business uploads a real sample MP4, pays demo coins, and
// checks that the public feed displays its sponsored video.
test('E2E — Business publishes and boosts a Style Feed video', async ({ page, browser, request }) => {
  const business = await registerAccount(request, 'business')
  await addBusinessProduct(request, 'Javier Demo Jacket')
  await signIn(page, business)
  await page.goto('/business/style-videos')
  await expect(page.getByRole('heading', { name: 'Style Feed studio' })).toBeVisible()

  await page.locator('#sf-product').selectOption({ index: 1 })
  await page.locator('#sf-caption').fill('A classic jacket for your next presentation')
  await page.locator('#sf-file').setInputFiles(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'tiny-outfit.mp4'))
  await page.getByRole('button', { name: 'Publish to Style Feed' }).click()
  await expect(page.getByText('Video published! It is now part of the Style Feed.')).toBeVisible()
  await expect(page.locator('.sf-video-item')).toHaveCount(1)

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: /Boost video.*20 coins/i }).click()
  await expect(page.getByText(/Boost active/)).toBeVisible()
  await expect(page.locator('.sf-coins')).toContainText('80 coins')

  // A business account is restricted to its portal, so use an actual customer
  // session for the final public feed verification.
  const customer = await registerAccount(request, 'consumer')
  const customerContext = await browser.newContext()
  try {
    const customerPage = await customerContext.newPage()
    await signIn(customerPage, customer)
    await customerPage.goto('/style-feed')
    await expect(customerPage.locator('.sf-post')).toHaveCount(1)
    await expect(customerPage.locator('.sf-sponsored')).toBeVisible()
    await expect(customerPage.locator('.sf-product-card')).toContainText('Javier Demo Jacket')
  } finally {
    await customerContext.close()
  }
})
