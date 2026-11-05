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

test('E2E 1 - save survey and check For You / All Items', async ({ page }) => {
  await signIn(page)
  const originalResponse = await page.request.get('/api/survey')
  expect(originalResponse.ok()).toBeTruthy()
  const original = (await originalResponse.json()).survey

  try {
    await page.goto('/survey')
    await expect(page.getByText('Choose at least 2. Select as many as you like.')).toBeVisible()
    // Clear pre-existing test-account selections before choosing our own.
    for (const name of ['Minimalist', 'Streetwear', 'Vintage', 'Y2K', 'Preppy', 'Classic', 'Romantic']) {
      const card = page.locator('.survey-style-card').filter({ hasText: name })
      if (await card.getAttribute('aria-pressed') === 'true') await card.click()
    }
    for (const choice of ['University','Presentation','Interview','Date','Internship / work','Casual outings','Formal events']) {
      const button = page.locator('.survey-occasion-grid button').filter({ hasText: choice })
      if (await button.getAttribute('aria-pressed') === 'true') await button.click()
    }
    await page.locator('.survey-style-card').filter({ hasText: 'Y2K' }).click()
    await page.locator('.survey-style-card').filter({ hasText: 'Vintage' }).click()
    await page.locator('.survey-occasion-grid button').filter({ hasText: 'Date' }).click()
    await page.getByRole('slider', { name: 'Budget per item' }).evaluate(el => {
      el.value = '65'
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.getByRole('button', { name: /Save & personalise Discover/ }).click()
    await expect(page).toHaveURL(/\/discover(?:\?|$)/)
    await expect(page.locator('#discover-style option')).toHaveText(['Style', 'Y2K', 'Vintage'])
    await expect(page.locator('#discover-occasion option')).toHaveText(['Occasion', 'Date'])
    await expect(page.locator('#discover-price option')).toHaveText(['Price', 'Up to S$20', 'Up to S$40', 'Up to S$60', 'Up to S$65'])
    await page.getByRole('button', { name: 'All items' }).click()
    await expect(page.locator('#discover-style option')).toHaveCount(8)
    await expect(page.locator('#discover-occasion option')).toHaveCount(8)
  } finally {
    // Restore the test account's profile so the run is repeatable.
    if (original?.preferredStyles?.length >= 2 && original?.activities?.length) {
      await page.request.post('/api/survey', { data: {
        preferredStyles: original.preferredStyles,
        activities: original.activities,
        budget: original.budget,
      } })
    }
  }
})
