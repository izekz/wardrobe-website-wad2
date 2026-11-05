import { test, expect } from '@playwright/test';
import { adminAccount } from './fixtures.js';

test('E2E2: admin logs out through the account menu', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Account menu' })
    .click();

  await page.getByRole('button', { name: 'Log out' })
    .click();

  await expect(
    page.getByRole('heading', {
      name: 'Welcome back',
      exact: true,
    })
  ).toBeVisible();

});
