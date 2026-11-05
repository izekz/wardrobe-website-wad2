import { test, expect } from '@playwright/test'
import { logInAsNewBusiness, smallPhoto } from './helpers.js'

test('E2E: a business spends 20 coins to boost a product', async ({ page, request }) => {
  await logInAsNewBusiness(page, request)
  const created = await request.post('/api/business/products', {
    headers: { Origin: 'http://127.0.0.1:5199' },
    data: { name: 'Linen shirt', price: 30, style: 'Minimalist', category: 'Tops', colours: ['White'], material: 'Linen',
      occasions: ['University'], sizeStock: { M: 5 }, description: 'Light linen shirt.',
      photo: `data:image/png;base64,${smallPhoto.toString('base64')}` },
  })
  expect(created.ok()).toBeTruthy()

  await page.goto('/business/promotions')
  const coins = page.locator('.biz-page-head').getByText(/^\d+$/)
  await expect(coins).toHaveText('100')

  // The page asks the business to confirm before spending coins.
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: /^Boost/ }).click()

  await expect(page.getByText('Boost is now active for “Linen shirt”.')).toBeVisible()
  await expect(coins).toHaveText('80')
})
