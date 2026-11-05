import { test, expect } from '@playwright/test'
import { registerAccount, signIn } from './helpers.js'

// E2E TEST 1: real browser + Express + isolated MongoDB, not mocked API responses.
test('E2E — Alex posts, views and deletes an Outfit Request', async ({ page, request }) => {
  const alex = await registerAccount(request, 'consumer')
  await signIn(page, alex)
  await page.goto('/community/requests')
  await expect(page.getByRole('heading', { name: 'My outfit requests' })).toBeVisible()

  const deadline = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10)
  const title = 'Javier E2E presentation jacket'
  await page.locator('#request-title').fill(title)
  await page.locator('#request-occasion').fill('University presentation')
  await page.locator('#request-budget').fill('40')
  await page.locator('#request-style').selectOption('Classic')
  await page.locator('#request-deadline').fill(deadline)
  await page.locator('#request-description').fill('A neutral jacket that works with my wardrobe.')
  await page.getByRole('button', { name: 'Post request' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Your request has been saved.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Open', { exact: true })).toBeVisible()
  await page.goto('/community/requests')
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: `Delete ${title}` }).click()
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Your next outfit starts here' })).toBeVisible()
})
