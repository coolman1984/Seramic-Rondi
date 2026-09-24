import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('works on a phone: menu, cards and no sideways scrolling', async ({ page }) => {
  await login(page, 'factory.mgr');
  await page.getByRole('button', { name: 'القائمة' }).click();
  await page.getByRole('link', { name: 'البيانات الأساسية' }).last().click();
  await page.getByRole('link', { name: /المعدات والأفران/ }).click();
  await expect(page.getByRole('button', { name: /فرن ٢/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
