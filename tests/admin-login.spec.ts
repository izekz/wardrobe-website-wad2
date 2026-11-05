import { test, expect } from '@playwright/test';

test('E2E1: admin login opens the admin dashboard', async ({ page }) => {
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
});