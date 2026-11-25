import { expect, test } from '@playwright/test';

test('opening explorer loads and offers the userscript download', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Opening Explorer' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Tải userscript/ })).toHaveAttribute('href', '/opmas.user.js');
  await expect(page.getByRole('heading', { name: 'Thư viện khai cuộc' })).toBeVisible();
});
