import { test, expect } from '@playwright/test'

// Login is only test setup. This submission tests the customer's features, not authentication.
async function signIn(page) {
  const email = process.env.CUSTOMER_TEST_EMAIL
  const password = process.env.CUSTOMER_TEST_PASSWORD
  if (!email || !password) throw new Error('Set CUSTOMER_TEST_EMAIL and CUSTOMER_TEST_PASSWORD before running E2E tests.')
  const response = await page.request.post('/api/auth/login', {
    data: { email, password, remember: false },
  })
  expect(response.ok(), `Test customer login setup failed: ${response.status()}`).toBeTruthy()
  const data = await response.json()
  expect(data.user?.role).toBe('consumer')
}

test('E2E 2 - Like, cart and checkout a test product', async ({ page }) => {
  test.skip(process.env.CUSTOMER_ALLOW_PURCHASE !== 'yes',
    'Checkout modifies inventory. Set CUSTOMER_ALLOW_PURCHASE=yes only for a separate test database.')
  const productId = process.env.CUSTOMER_TEST_PRODUCT_ID
  if (!productId) throw new Error('Set CUSTOMER_TEST_PRODUCT_ID to an in-stock test product ID.')
  await signIn(page)
  const shopResponse = await page.request.get('/api/commerce/shop')
  expect(shopResponse.ok()).toBeTruthy()
  const shop = await shopResponse.json()
  if (shop.cart?.length) throw new Error('Use an empty test cart for this E2E test. Do not purchase items from a shared demo account.')
  const productResponse = await page.request.get(`/api/catalog/products/${productId}`)
  expect(productResponse.ok()).toBeTruthy()
  const { product } = await productResponse.json()
  expect(product.stock).toBeGreaterThan(0)
  // Use a dedicated test product and empty test cart for repeatable results.

  await page.goto(`/discover/products/${productId}`)
  await expect(page.locator('.disc-detail-copy h1')).toHaveText(product.name)
  const likeButton = page.getByRole('button', { name: /Add to Likes|Liked/ })
  if (await likeButton.getAttribute('aria-pressed') !== 'true') await likeButton.click()
  await page.goto('/discover/liked')
  await expect(page.getByRole('heading', { name: product.name })).toBeVisible()

  await page.goto(`/discover/products/${productId}`)
  if (product.availableColours?.length > 1) await page.locator('#detail-colour').selectOption({ label: product.availableColours[0] })
  if (product.sizes?.length) {
    const available = product.sizes.find(size => product.sizeStock ? product.sizeStock[size] > 0 : product.stock > 0)
    if (!available) throw new Error('Choose a test product with at least one available size.')
    await page.locator('.disc-sizes button').filter({ hasText: available }).click()
  }
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click()
  await page.goto('/discover/cart')
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible()
  await expect(page.getByText(product.name).first()).toBeVisible()
  await page.getByRole('link', { name: 'Proceed to checkout' }).click()
  await page.getByLabel('Full name').fill('Test Customer')
  await page.getByLabel('Email').fill('customer@example.com')
  await page.getByLabel('Address').fill('123 Test Road')
  await page.getByLabel('Postal code').fill('541123')
  await page.getByLabel('Cardholder name').fill('Test Customer')
  await page.getByLabel('Card number').fill('4111111111111111')
  await page.getByLabel('Expiry').fill('1230')
  await page.getByLabel('CVV').fill('123')
  await page.locator('button.checkout-pay').click()
  await expect(page.getByText('ORDER CONFIRMED')).toBeVisible()
  await expect(page.locator('.checkout-success strong')).toContainText(/^#DR\d{6}$/)
  const after = await page.request.get(`/api/catalog/products/${productId}`)
  expect(after.ok()).toBeTruthy()
  expect((await after.json()).product.stock).toBeLessThan(product.stock)
})
