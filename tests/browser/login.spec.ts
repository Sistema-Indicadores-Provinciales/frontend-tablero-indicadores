import { test, expect } from '@playwright/test';

test('login fields remain controlled and Enter opens the authenticated index', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
  await page.route('**/auth/login', route => route.fulfill({ json: { data: { access_token: 'test-token' } } }));
  await page.route('**/user', route => route.fulfill({ json: { data: { _id: 'test', username: 'Ana', profileType: 'ADMIN', access: [] } } }));
  await page.route('**/user/my-dashboards', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/dashboard/get-all', route => route.fulfill({ json: { data: [] } }));
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill('Ana');
  await page.getByLabel('Contraseña').fill('test-only-password');
  await page.getByLabel('Contraseña').press('Enter');
  await expect(page).toHaveURL(/\/main$/);
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
  expect(errors.filter(message => /uncontrolled|controlled input/i.test(message))).toEqual([]);
});

test('connection failure is visible and permits retry', async ({ page }) => {
  await page.route('**/auth/login', route => route.abort('connectionrefused'));
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill('Ana');
  await page.getByLabel('Contraseña').fill('test-only-password');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar');
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/\/login$/);
});

test('profile failure does not enter with an incomplete session', async ({ page }) => {
  await page.route('**/auth/login', route => route.fulfill({ json: { data: { access_token: 'test-token' } } }));
  await page.route('**/user', route => route.fulfill({ status: 503, json: { error: 'No se pudo cargar tu usuario.' } }));
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill('Ana');
  await page.getByLabel('Contraseña').fill('test-only-password');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar tu usuario');
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('user'))).toBeNull();
});
