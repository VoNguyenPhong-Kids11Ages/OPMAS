import { expect, test } from '@playwright/test';

test('opening explorer loads and offers the project-site userscript download', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Opening Explorer' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Tải userscript/ })).toHaveAttribute('href', '/OPMAS/opmas.user.js');
  await expect(page.getByRole('heading', { name: 'Thư viện khai cuộc' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Italian Game|King.s Pawn Game/ }).first()).toBeVisible();
});

test('navigation opens the PGN analyzer and detects a known opening', async ({ page }) => {
  await page.goto('/#/analyzer');
  await expect(page.getByRole('heading', { name: 'PGN Analyzer' })).toBeVisible();
  await page.getByLabel('PGN input').fill('[Event "OPMAS test"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4');
  await expect(page.getByText(/Italian Game/)).toBeVisible();
});

test('about route explains the project', async ({ page }) => {
  await page.goto('/#/about');
  await expect(page.getByRole('heading', { name: 'About OPMAS' })).toBeVisible();
  await expect(page.getByText(/mã nguồn mở/i)).toBeVisible();
});
