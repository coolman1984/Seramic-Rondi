import { expect, type Page } from '@playwright/test';

export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'Rondi-Demo-2026';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin-Rondi-2026';

export async function login(page: Page, username: string, password = DEMO_PASSWORD) {
  await page.goto('/login');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** أي خطأ في الكونسول (زي كود اتمنع بسبب سياسة الأمان) يوقع الاختبار */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && !/401|403|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
