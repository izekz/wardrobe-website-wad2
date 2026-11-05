import { test, expect } from '@playwright/test';

test('E2E2: admin logs out through the account menu', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/login');

  await page.getByRole('textbox', { name: 'Email address' })
    .fill('admin@gmail.com');

  await page.getByRole('textbox', { name: 'Password' })
    .fill('admin1234567');

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
