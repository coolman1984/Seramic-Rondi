import { expect, test } from '@playwright/test';
import { ADMIN_PASSWORD, login, watchConsole } from './helpers';

const stamp = Date.now().toString().slice(-5);

test('wrong password shows a clear Arabic message', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.fill('#username', 'store');
  await page.fill('#password', 'wrong-password-x');
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByText('اسم الدخول أو كلمة السر غلط')).toBeVisible();
});

test('production manager manages master data end to end', async ({ page }) => {
  const errors = watchConsole(page);
  await login(page, 'prod.mgr');
  await page.getByRole('link', { name: 'البيانات الأساسية' }).first().click();
  await page.getByRole('link', { name: /درجات اللون/ }).click();
  await page.getByRole('button', { name: /إضافة درجة لون/ }).click();

  // الأرقام العربي مقبولة
  const code = `ز${stamp}`.slice(0, 6);
  await page.fill('#f-code', code.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]));
  await page.fill('#f-description', 'درجة تجربة');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('اتضاف درجة لون جديد')).toBeVisible();

  await page.getByPlaceholder(/دوّر/).fill(code);
  await page.getByRole('cell', { name: 'درجة تجربة' }).click();
  await page.fill('#f-description', 'درجة تجربة معدلة');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByRole('cell', { name: 'درجة تجربة معدلة' })).toBeVisible();

  await page.getByRole('cell', { name: 'درجة تجربة معدلة' }).click();
  await page.getByRole('button', { name: 'إيقاف' }).click();
  await page.getByRole('button', { name: 'أيوه، وقّفه' }).click();
  await expect(page.getByText('مفيش نتايج')).toBeVisible();
  expect(errors).toEqual([]);
});

test('validation errors appear next to each field', async ({ page }) => {
  await login(page, 'prod.mgr');
  await page.goto('/master/materials');
  await page.getByRole('button', { name: /إضافة خامة/ }).click();
  await page.fill('#f-code', 'bad code');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('حروف وأرقام بس')).toBeVisible();
  await expect(page.getByText('اسم الخامة لازم تكون ٢ حروف')).toBeVisible();
});

test('variant form previews m² per carton and pallet', async ({ page }) => {
  await login(page, 'prod.mgr');
  await page.goto('/master/variants');
  await page.getByRole('cell', { name: /رويال رخامي ٦٠×٦٠/ }).click();
  await expect(page.getByText('الكرتونة =')).toContainText('١٫٤٤');
  await page.fill('#f-piecesPerCarton', '٣');
  await expect(page.getByText('الكرتونة =')).toContainText('١٫٠٨');
});

test('shift supervisor only sees what the role allows', async ({ page }) => {
  await login(page, 'sup.a');
  const nav = page.getByRole('navigation', { name: 'القائمة الرئيسية' });
  await expect(nav.getByRole('link', { name: 'البيانات الأساسية' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'المستخدمين' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'سجل العمليات' })).toHaveCount(0);
  await page.goto('/master/models');
  await expect(page.getByRole('button', { name: /إضافة/ })).toHaveCount(0);
  await page.goto('/users');
  await expect(page.getByText('الصفحة دي مش ضمن صلاحياتك')).toBeVisible();
});

test('a new user must change the temporary password on first login', async ({ page, browser }) => {
  await login(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/users');
  await page.getByRole('button', { name: 'مستخدم جديد' }).click();
  const username = `worker${stamp}`;
  await page.fill('#u', username);
  await page.fill('#n', 'عامل تجربة');
  await page.selectOption('#r', { label: 'مشرف الوردية' });
  await page.fill('#pw', 'Temp-Pass-4455');
  await page.getByRole('button', { name: /إنشاء الحساب/ }).click();
  await expect(page.getByText('اتعمل الحساب')).toBeVisible();

  const ctx = await browser.newContext({ locale: 'ar-EG' });
  const p2 = await ctx.newPage();
  await p2.goto('/login');
  await p2.fill('#username', username);
  await p2.fill('#password', 'Temp-Pass-4455');
  await p2.getByRole('button', { name: 'دخول' }).click();
  await expect(p2.getByRole('heading', { name: 'اختار كلمة سر جديدة' })).toBeVisible();
  await p2.fill('#current', 'Temp-Pass-4455');
  await p2.fill('#new', 'My-Own-Pass-2026');
  await p2.fill('#confirm', 'My-Own-Pass-2026');
  await p2.getByRole('button', { name: 'حفظ كلمة السر' }).click();
  await expect(p2).toHaveURL(/\/$/);
  await expect(p2.getByRole('heading', { level: 1 })).toContainText('عامل');
  await ctx.close();
});

test('audit log shows the chain is intact', async ({ page }) => {
  await login(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/audit');
  await expect(page.getByText(/السجل سليم/)).toBeVisible();
});

test('logout returns to the login page and blocks the app', async ({ page }) => {
  await login(page, 'store');
  await page.getByRole('button', { name: /سيد حسانين/ }).click();
  await page.getByRole('button', { name: 'خروج' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/master');
  await expect(page).toHaveURL(/\/login/);
});
