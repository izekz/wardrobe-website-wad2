import { test, expect } from '@playwright/test'
import { login, requireLocalTestApp, itemPhoto } from '../../e2e-helpers.js'

test.describe('Save and update the same outfit (end-to-end)', () => {
  requireLocalTestApp(test)
  test('WOP-E02: build and save an outfit, then edit and update that same outfit', async ({ page }) => {
    await login(page, 'planner.student@example.invalid')
    await page.goto('/outfit-planner')
    await expect(page.getByRole('button', { name: 'Choose pieces to save', exact: true })).toBeDisabled()
    await page.getByLabel('Occasion', { exact: true }).selectOption('No specific occasion')
    for (const name of ['White linen shirt', 'Black trousers', 'Black loafers']) {
      await page.getByRole('button', { name: `Use this piece: ${name}`, exact: true }).click()
      await expect(page.getByRole('button', { name: `Remove ${name} from outfit`, exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: `Use this piece: ${name}`, exact: true })).toHaveCount(0)
    }
    await expect(page.getByRole('progressbar', { name: 'Required basic pieces selected' })).toHaveAttribute('aria-valuenow', '3')
    await expect(page.getByRole('progressbar', { name: 'Selected outfit match score' })).toHaveAttribute('aria-valuenow', '100')
    await expect(page.getByRole('button', { name: 'Save outfit', exact: true })).toBeDisabled()
    await page.getByPlaceholder('Enter Name').fill('Campus look')
    await page.getByRole('button', { name: 'Save outfit', exact: true }).click()
    await expect(page).toHaveURL(/\/wardrobe\/saved$/)
    await expect(page.getByRole('heading', { name: 'Campus look', exact: true })).toBeVisible()
    const initial = (await (await page.request.get('/api/wardrobe/outfits')).json()).outfits
    expect(initial).toHaveLength(1)
    const id = initial[0].outfitId
    await page.getByRole('button', { name: 'View outfit', exact: true }).click()
    await page.getByRole('dialog', { name: 'Campus look', exact: true }).getByRole('link', { name: 'Edit this outfit', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`outfitId=${id}`))
    await expect(page.getByPlaceholder('Enter Name')).toHaveValue('Campus look')
    await expect(page.getByRole('button', { name: 'Remove White linen shirt from outfit', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Remove White linen shirt from outfit', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Use this piece: White linen shirt', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Use this piece: Blue overshirt', exact: true }).click()
    await page.getByPlaceholder('Enter Name').fill('Updated campus look')
    await page.getByRole('button', { name: 'Update Outfit', exact: true }).click()
    await expect(page).toHaveURL(/\/wardrobe\/saved$/)
    await expect(page.getByRole('heading', { name: 'Updated campus look', exact: true })).toBeVisible()
    await page.reload()
    const final = (await (await page.request.get('/api/wardrobe/outfits')).json()).outfits
    expect(final).toHaveLength(1)
    expect(final[0].outfitId).toBe(id)
    expect(final[0].pieces.map(piece => piece.name)).toEqual(expect.arrayContaining(['Blue overshirt', 'Black trousers', 'Black loafers']))
    expect(final[0].pieces.map(piece => piece.name)).not.toContain('White linen shirt')
  })
})
