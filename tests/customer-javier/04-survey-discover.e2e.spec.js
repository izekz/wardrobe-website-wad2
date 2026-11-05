import { test, expect } from '@playwright/test'
import { signIn } from './helpers.js'

test('E2E 1 - Survey preferences affect For You and All Items', async ({ page }) => {
  await signIn(page)
  await page.goto('/survey')
  await expect(page.getByText('Choose at least 2. Select as many as you like.')).toBeVisible()

  await page.locator('.survey-style-card').filter({ hasText: 'Y2K' }).click()
  await page.locator('.survey-style-card').filter({ hasText: 'Vintage' }).click()
  await page.locator('.survey-occasion-grid button').filter({ hasText: 'Date' }).click()
  await page.getByRole('slider', { name: 'Budget per item' }).evaluate(input => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '65')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.getByRole('button', { name: /Save & personalise Discover/ }).click()

  await expect(page).toHaveURL(/\/discover(?:\?|$)/)
  await expect(page.locator('#discover-style option')).toHaveText(['Style', 'Y2K', 'Vintage'])
  await expect(page.locator('#discover-occasion option')).toHaveText(['Occasion', 'Date'])
  await expect(page.locator('#discover-price option')).toHaveText(['Price', 'Up to S$20', 'Up to S$40', 'Up to S$60', 'Up to S$65'])
  await expect(page.getByText('Javier Test Jacket')).toBeVisible()
  await expect(page.getByText('Javier Test High Price Jacket')).toHaveCount(0)

  await page.getByRole('button', { name: 'All items' }).click()
  await expect(page.locator('#discover-style option')).toHaveCount(8)
  await expect(page.locator('#discover-occasion option')).toHaveCount(8)
  await expect(page.getByText('Javier Test High Price Jacket')).toBeVisible()
})
