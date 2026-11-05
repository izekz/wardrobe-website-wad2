import { test, expect } from '@playwright/test'
import { logInAsNewBusiness, smallPhoto } from './helpers.js'

test('E2E: a business adds shoes using a US number size', async ({ page, request }) => {
  await logInAsNewBusiness(page, request)
  await page.goto('/business/products/new')

  await page.getByLabel('Product name').fill('Canvas sneakers')
  await page.getByLabel('Price (S$)').fill('80')
  await page.getByLabel('Style').selectOption('Minimalist')
  await page.getByLabel('Category').selectOption('Shoes')
  await page.getByRole('checkbox', { name: 'Black' }).check()
  await page.getByLabel('Material').fill('Canvas')
  await page.getByRole('checkbox', { name: 'University' }).check()
  await page.getByLabel('Description').fill('Light everyday sneakers.')
  await page.locator('#product-photo').setInputFiles({ name: 'shoe.png', mimeType: 'image/png', buffer: smallPhoto })
  await page.getByLabel('Stock for size 1').fill('5')

  // A letter size is rejected for shoes.
  await page.getByLabel('Size 1 name').fill('S')
  await page.getByRole('button', { name: 'Publish to store' }).click()
  await expect(page.getByRole('alert')).toContainText('Shoes use US number sizes')
  await expect(page).toHaveURL(/\/business\/products\/new/)

  // A US number size is accepted, and the product appears on Manage products.
  await page.getByLabel('Size 1 name').fill('9')
  await page.getByRole('button', { name: 'Publish to store' }).click()
  await expect(page).toHaveURL(/\/business\/products$/)
  await expect(page.getByText('Canvas sneakers')).toBeVisible()
})
