import { test, expect, Page } from '@playwright/test';

async function setup(page: Page, admin = true) {
  const state = { removed: false, configured: '', googleRequests: [] as (string | undefined)[], deleteFailure: false, privateSheet: false };
  const board = { _id: 'board', name: 'Prueba eliminable', keyname: 'prueba', show: true, generatedWorkspaceId: 'saved', sections: [{ _id: 'section', keyname: 'graficos', name: 'Gráficos', show: true, workspaceId: 'saved' }] };
  await page.addInitScript(admin => localStorage.setItem('user', JSON.stringify({ _id: 'test', username: 'Ana', profileType: admin ? 'ADMIN' : 'INVITADO', access_token: 'test' })), admin);
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'application/javascript', body: `window.google = { accounts: { oauth2: { initTokenClient: function(options) { return { requestAccessToken: function() { options.callback({access_token: 'google-test-only'}); } }; }, revoke: function(token, callback) { callback(); } } } };` }));
  await page.route(/:(3000|8000)\//, async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let data: any = { data: [] }, status = 200;
    if (path === '/dashboard/get-all') data = { data: state.removed ? [] : [board] };
    else if (path === '/user/my-dashboards') data = { data: state.removed ? [] : [{ ...board, sections: ['graficos'] }] };
    else if (path === '/dashboard/reconcile-generated') data = { data: { removed: [] } };
    else if (path === '/dashboard/board' && request.method() === 'DELETE') {
      if (state.deleteFailure) { status = 503; data = { error: 'No disponible' }; }
      else { state.removed = true; data = { data: { message: 'Tablero eliminado.' } }; }
    }
    else if (path === '/v2/workspaces/restore-menu') data = { restored: 0 };
    else if (path === '/v2/workspaces') data = [];
    else if (path === '/v2/sources') data = [];
    else if (path === '/v2/google/status') data = { client_id: state.configured, public_access: true };
    else if (path === '/v2/google/settings') { state.configured = request.postDataJSON().client_id; data = { client_id: state.configured, public_access: true }; }
    else if (path === '/v2/sources/google') {
      const token = request.headers()['x-google-access-token'];
      state.googleRequests.push(token);
      if (state.privateSheet && !token) { status = 409; data = { detail: 'No se pudo leer esta hoja sin una cuenta. Si es privada, conectá Google.' }; }
      else data = { _id: 'google-source', name: 'Mi hoja', kind: 'google', ...(state.privateSheet ? {} : { access_mode: 'public' }) };
    }
    else if (path.endsWith('/sheets')) data = ['Datos'];
    else if (path.endsWith('/preview')) data = { row_count: 1, columns: ['Valor'], column_meta: { Valor: { type: 'number', unique_values: [5] } }, preview: [{ Valor: 5 }], raw_preview: [['Valor'], [5]], warnings: [] };
    await route.fulfill({ status, json: data });
  });
  return state;
}

test('deletion removes the row and menu, persists on reload and errors keep the row', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/tableros');
  await page.getByRole('button', { name: 'Eliminar Prueba eliminable', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Eliminar tablero', exact: true });
  state.deleteFailure = true;
  await dialog.getByRole('button', { name: 'Eliminar tablero completo', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('No se pudo completar');
  expect(state.removed).toBe(false);
  state.deleteFailure = false;
  await dialog.getByRole('button', { name: 'Eliminar tablero completo', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Prueba eliminable', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('button', { name: 'Prueba eliminable', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Prueba eliminable', exact: true })).toHaveCount(0);
});

test('public link imports without configuring or connecting Google', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/generador');
  const panel = page.getByRole('region', { name: 'Google Sheets', exact: true });
  await expect(panel.getByRole('button', { name: 'Conectar Google', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'ID de cliente OAuth' })).toHaveCount(0);
  await panel.getByRole('textbox', { name: 'Enlace de Google Sheets' }).fill('https://docs.google.com/spreadsheets/d/e/' + 'a'.repeat(30) + '/pubhtml?gid=42');
  await panel.getByRole('button', { name: 'Usar hoja', exact: true }).click();
  await expect(page.getByText('1 filas · 1 columnas.', { exact: false })).toBeVisible();
  expect(state.googleRequests).toEqual([undefined]);
  await panel.screenshot({ path: 'test-results/google-public.png', animations: 'disabled' });
});

test('admin configures Google in the app then connects and imports the sheet with the new token', async ({ page }) => {
  const state = await setup(page);
  state.privateSheet = true;
  await page.goto('/generador');
  const panel = page.getByRole('region', { name: 'Google Sheets', exact: true });
  await panel.getByRole('textbox', { name: 'Enlace de Google Sheets' }).fill('https://docs.google.com/spreadsheets/d/' + 'a'.repeat(30));
  await panel.getByRole('button', { name: 'Usar hoja', exact: true }).click();
  await panel.getByRole('link', { name: 'Habilitarlo desde Administración → Conexiones' }).click();
  await expect(page.getByRole('heading', { name: 'Conexiones del sistema' })).toBeVisible();
  await expect(page.locator('header')).toContainText('Administración · Conexiones');
  await page.getByRole('textbox', { name: 'ID de cliente OAuth' }).fill('123-testing.apps.googleusercontent.com');
  await page.getByRole('button', { name: 'Guardar configuración', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Configuración guardada' })).toBeVisible();
  await page.screenshot({ path: 'test-results/google-administration.png', animations: 'disabled' });
  await page.getByRole('link', { name: 'Ir al generador' }).click();
  await expect(panel.getByRole('button', { name: 'Conectar Google', exact: true })).toBeEnabled();
  await panel.getByRole('textbox', { name: 'Enlace de Google Sheets' }).fill('https://docs.google.com/spreadsheets/d/' + 'a'.repeat(30));
  await panel.getByRole('button', { name: 'Conectar Google', exact: true }).click();
  await expect(panel.getByText('Cuenta conectada', { exact: true })).toBeVisible();
  await expect(page.getByText('1 filas · 1 columnas.', { exact: false })).toBeVisible();
  expect(state.googleRequests).toEqual([undefined, 'google-test-only']);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('google-test-only');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/google-connected.png', fullPage: true, animations: 'disabled' });
});

test('guests see who must configure Google and cannot edit the shared settings', async ({ page }) => {
  const state = await setup(page, false);
  state.privateSheet = true;
  await page.goto('/generador');
  const panel = page.getByRole('region', { name: 'Google Sheets', exact: true });
  await panel.getByRole('textbox', { name: 'Enlace de Google Sheets' }).fill('https://docs.google.com/spreadsheets/d/' + 'a'.repeat(30));
  await panel.getByRole('button', { name: 'Usar hoja', exact: true }).click();
  await expect(panel.getByRole('alert').filter({ hasText: 'Un administrador debe habilitarlo' })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Habilitarlo desde Administración → Conexiones' })).toHaveCount(0);
  await page.goto('/administracion/conexiones');
  await expect(page).toHaveURL(/\/main$/);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('button', { name: 'ADMINISTRACIÓN', exact: true })).toHaveCount(0);
});

test('administration is accessible from the menu and fits a small screen', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/generador');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'ADMINISTRACIÓN', exact: true }).click();
  await page.locator('.MuiDrawer-root').getByRole('button').first().click();
  await expect(page.getByRole('heading', { name: 'Conexiones del sistema' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/google-administration-mobile.png', fullPage: true, animations: 'disabled' });
});
