import { test, expect, Page } from '@playwright/test';

const path = '/ingresos/graficos';
const widget = { id: 'chart', title: 'Total de ingresos', width: 12, library: 'Plotly', config: {
  sheet: 'Datos', header_row: 1, decimal: ',', types: {}, chart_type: 'indicator', aggregation: 'sum', x_col: 'Mes', y_col: 'Valor', group_col: '', date_bucket: 'none', filters: {},
} };
async function setup(page: Page, privateSheet = true) {
  const state = { connected: new Set<string>(), expired: false, connectCount: 0, chartFailure: false, savedChanges: 0, requests: [] as any[], secret: '', persistent: true };
  const board = { _id: 'board', keyname: 'ingresos', name: 'Ingresos', show: true, sections: [{ _id: 'section', keyname: 'graficos', name: 'Gráficos', show: true, workspaceId: 'saved' }] };
  const profile = (id: string) => ({ _id: id, username: id, profileType: id === 'admin' ? 'ADMIN' : 'INVITADO', access_token: id });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', 'yes');
      localStorage.setItem('user', JSON.stringify({ _id: 'reader', username: 'reader', profileType: 'INVITADO', access_token: 'reader' }));
    }
  });
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'application/javascript', body: `window.google = { accounts: { oauth2: { initCodeClient(options) { return { requestCode() { options.callback({code: 'one-time-google-code'}); } }; } } } };` }));
  await page.route(/:(3000|8000)\//, async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method(), user = req.headers().authorization?.replace('Bearer ', '') || '';
    const googleStatus = () => ({ client_id: 'test.apps.googleusercontent.com', persistent_available: state.persistent, connected: state.connected.has(user), public_access: true });
    let data: any = { data: [] }, status = 200;
    if (url.pathname === '/auth/login') data = { data: { access_token: req.postDataJSON().username } };
    else if (url.pathname === '/user') data = { data: profile(user) };
    else if (url.pathname === '/dashboard/get-all') data = { data: [board] };
    else if (url.pathname === '/user/my-dashboards') data = { data: [{ ...board, sections: ['graficos'] }] };
    else if (url.pathname === '/v2/google/status') data = googleStatus();
    else if (url.pathname === '/v2/google/settings') { state.secret = req.postDataJSON().client_secret || ''; state.persistent = !!state.secret; data = googleStatus(); }
    else if (url.pathname === '/v2/google/connect') {
      expect(req.postDataJSON()).toEqual({ code: 'one-time-google-code', client_id: 'test.apps.googleusercontent.com' });
      expect(req.headers()['x-requested-with']).toBe('XMLHttpRequest');
      state.connected.add(user); state.expired = false; state.connectCount++; data = googleStatus();
    }
    else if (url.pathname === '/v2/google/connection') { state.connected.delete(user); data = { connected: false, revoked: true }; }
    else if (url.pathname === '/v2/workspaces/saved/view') data = { _id: 'saved', name: 'Gráficos', source_id: 'source', widgets: [widget], can_edit: false, source_kind: privateSheet ? 'google' : 'upload' };
    else if (url.pathname.endsWith('/widgets/chart/chart')) {
      expect(req.headers()['x-google-access-token']).toBeUndefined();
      const filters = method === 'POST' ? req.postDataJSON().filters : {};
      state.requests.push({ user, filters });
      if (privateSheet && (!state.connected.has(user) || state.expired)) { status = 409; data = { detail: 'Google requiere una nueva autorización. Volvé a conectar tu cuenta.' }; }
      else if (state.chartFailure) { status = 503; data = { detail: 'No se pudieron consultar los datos.' }; }
      else {
        const selected = filters.Mes || [], noRows = selected.includes('Inexistente');
        data = { labels: ['Total'], datasets: noRows ? [] : [{ label: 'Total', data: [selected.includes('Enero') ? 500 : 1500] }], filtered_rows: noRows ? 0 : selected.length ? 1 : 2,
          warnings: [], filter_options: { Mes: { values: ['Enero', 'Febrero'], total: 2 }, Valor: { values: ['500', '1000'], total: 2 } } };
      }
    }
    else if (url.pathname.includes('/v2/workspaces') && ['POST', 'PUT'].includes(method)) state.savedChanges++;
    await route.fulfill({ status, json: data });
  });
  return state;
}
async function signOut(page: Page) {
  await page.locator('button[aria-haspopup="true"]').click();
  await page.getByRole('menuitem', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('user'))).toBeNull();
}
async function signIn(page: Page, user: string) {
  await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill(user);
  await page.getByLabel('Contraseña').fill('test-only-password');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(/\/main$/);
  await page.goto(path);
}

test('Google stays connected across reload, logout and login, without sharing another users grant', async ({ page }) => {
  const state = await setup(page);
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Gráficos', exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Conectar Google', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  await page.reload();
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  expect(state.connectCount).toBe(1);
  await page.screenshot({ path: 'test-results/google-persistent-desktop.png', fullPage: true });
  await signOut(page);
  await signIn(page, 'other');
  await expect(page.getByText('Google requiere una nueva autorización.', { exact: false })).toBeVisible();
  await expect(page.locator('.generator-indicator strong')).toHaveCount(0);
  await signOut(page);
  await signIn(page, 'reader');
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  expect(state.connectCount).toBe(1);
  const stored = await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage }));
  expect(stored).not.toContain('one-time-google-code');
  await page.getByRole('button', { name: 'Desconectar cuenta', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Conectar Google', exact: true })).toBeVisible();
  expect(state.connected.size).toBe(0);
});

test('viewers filter and clear without editing, keep filters when refreshing and see empty and error states', async ({ page }) => {
  const state = await setup(page, false);
  await page.goto(path);
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  await expect(page.getByRole('link', { name: 'Editar gráficos y accesos' })).toHaveCount(0);
  const panel = page.getByRole('region', { name: 'Filtros de Total de ingresos', exact: true });
  await panel.getByRole('combobox', { name: 'Mes', exact: true }).fill('Enero');
  await page.getByRole('option', { name: 'Enero', exact: true }).click();
  await panel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('500');
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('500');
  expect(state.requests.at(-1).filters.Mes).toEqual(['Enero']);
  await panel.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  await panel.getByRole('combobox', { name: 'Mes', exact: true }).fill('Inexistente');
  await panel.getByRole('combobox', { name: 'Mes', exact: true }).press('Enter');
  await panel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByText('No hay datos para los filtros seleccionados.')).toBeVisible();
  await panel.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  state.chartFailure = true;
  await panel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByText('No se pudieron consultar los datos.')).toBeVisible();
  await expect(page.locator('.generator-indicator strong')).toHaveCount(0);
  state.chartFailure = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  expect(state.savedChanges).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/filters-mobile.png', fullPage: true });
});

test('revoked Google permission can be renewed without leaving the section', async ({ page }) => {
  const state = await setup(page);
  state.connected.add('reader'); state.expired = true;
  await page.goto(path);
  await expect(page.getByText('Google requiere una nueva autorización.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar / renovar cuenta' }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  await expect(page.getByText('Google requiere una nueva autorización.', { exact: false })).toHaveCount(0);
});

test('administrator enables persistent Google and secret is cleared after save', async ({ page }) => {
  const state = await setup(page);
  state.persistent = false;
  await page.goto(path);
  await signOut(page);
  await signIn(page, 'admin');
  await page.goto('/administracion/conexiones');
  await page.getByLabel('Secreto del cliente OAuth', { exact: true }).fill('test-secret-only');
  await page.getByRole('button', { name: 'Guardar configuración' }).click();
  await expect(page.getByText('Conexión permanente habilitada.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Secreto del cliente OAuth', { exact: true })).toHaveValue('');
  expect(state.secret).toBe('test-secret-only');
  await page.reload();
  await expect(page.getByText('Las cuentas pueden permanecer conectadas por usuario.')).toBeVisible();
  await expect(page.getByLabel('Secreto del cliente OAuth', { exact: true })).toHaveValue('');
});
