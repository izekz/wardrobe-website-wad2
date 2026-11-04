import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/login');
  await page.getByRole('textbox', { name: 'Email address' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('jack123@gmail.com');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('jack12345678');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByText('Streetwear').first().click();
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Save & personalise Discover →' }).click();
  expect(page.getByText('plain black tee')).toBeVisible()
});