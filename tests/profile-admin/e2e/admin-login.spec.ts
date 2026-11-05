import { test, expect } from '@playwright/test';
import { adminAccount } from './fixtures.js';

test('E2E1: admin login opens the admin dashboard', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('textbox', { name: 'Email address' })
    .fill(adminAccount.email);

  await page.getByRole('textbox', { name: 'Password' })
    .fill(adminAccount.password);

  await page.getByRole('textbox', { name: 'Password' })
    .press('Enter');

  await expect(
    page.getByRole('heading', {
      name: 'Admin dashboard',
      exact: true,
    })
  ).toBeVisible();
});
