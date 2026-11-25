import { expect, test } from '@playwright/test';

test('home page offers the userscript download', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'OPMAS' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tải userscript' })).toHaveAttribute('href', '/opmas.user.js');
});
