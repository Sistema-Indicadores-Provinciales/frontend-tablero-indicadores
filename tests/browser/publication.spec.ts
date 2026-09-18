import { test, expect, Page } from '@playwright/test';

const widget = { id: 'chart', title: 'Total de ingresos', width: 12, library: 'Plotly', config: {
  sheet: 'Datos', header_row: 1, decimal: ',', types: {}, chart_type: 'indicator', aggregation: 'sum', x_col: 'Mes', y_col: 'Valor', group_col: '', date_bucket: 'none', filters: {},
} };
async function mockSystem(page: Page, { old = false, viewer = false, failPublish = false } = {}) {
  const state = { workspaces: old || viewer ? [{ _id: 'saved', name: 'Ingresos semanales', source_id: 'file', widgets: [widget] }] : [] as any[],
    published: viewer, recipients: viewer ? ['owner', 'reader'] : ['owner'], saves: 0, failures: failPublish ? 1 : 0, revoked: false };
  const userId = viewer ? 'reader' : 'owner';
  const dashboard = () => ({ _id: 'dashboard', keyname: 'ingresos-semanales', name: state.workspaces[0]?.name, show: true,
    icon: 'material-symbols:bar-chart-rounded', generatedWorkspaceId: 'saved', sections: [{ _id: 'section', keyname: 'graficos', name: 'Gráficos', show: true, workspaceId: 'saved' }] });
  const options = () => ({ published: state.published, canShare: !viewer, currentUserId: userId, canView: true, show: true,
    users: viewer ? [] : [{ _id: 'owner', username: 'Ana' }, { _id: 'reader', username: 'Bruno' }], recipientIds: state.recipients,
    path: '/ingresos-semanales/graficos', icon: dashboard().icon });
  await page.addInitScript(({ viewer, userId }) => localStorage.setItem('user', JSON.stringify({ _id: userId, username: viewer ? 'Bruno' : 'Ana', profileType: viewer ? 'INVITADO' : 'ADMIN', access_token: 'test' })), { viewer, userId });
  await page.route(/:(3000|8000)\//, async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let status = 200;
    let data: any = { data: [] };
    if (path === '/dashboard/get-all') data = { data: state.published ? [dashboard()] : [] };
    else if (path === '/v2/google/status') data = { client_id: '', public_access: false };
    else if (path === '/user/my-dashboards') data = { data: state.published && state.recipients.includes(userId) && !state.revoked ? [{ ...dashboard(), sections: ['graficos'] }] : [] };
    else if (path === '/v2/workspaces/restore-menu') { const restored = !state.published && state.workspaces.length > 0; state.published ||= restored; data = { restored: restored ? 1 : 0 }; }
    else if (path === '/v2/publication-options') data = options();
    else if (path === '/v2/workspaces/saved/publication') {
      if (method === 'PUT' && state.failures-- > 0) { status = 503; data = { detail: 'No se pudo actualizar el menú.' }; }
      else { if (method === 'PUT') { state.published = true; state.recipients = route.request().postDataJSON().recipientIds ?? state.recipients; } data = options(); }
    }
    else if (path === '/v2/workspaces' || path === '/v2/workspaces/saved') {
      if (method !== 'GET') { state.saves++; state.workspaces = [{ _id: 'saved', ...route.request().postDataJSON() }]; }
      data = path.endsWith('/saved') || method !== 'GET' ? state.workspaces[0] : state.workspaces;
    }
    else if (path === '/v2/workspaces/saved/view') {
      if (state.revoked) { status = 404; data = { detail: 'El tablero no está disponible o no tenés acceso.' }; }
      else data = { ...state.workspaces[0], can_edit: !viewer, source_kind: 'upload' };
    }
    else if (path.endsWith('/chart')) data = { labels: ['Total'], datasets: [{ label: 'Total', data: [1500] }], filtered_rows: 2, warnings: [] };
    else if (path === '/v2/sources') data = [{ _id: 'file', name: 'Ingresos.xlsx', kind: 'upload' }];
    else if (path.endsWith('/sheets')) data = ['Datos'];
    else if (path.endsWith('/preview')) data = {
      row_count: 2, columns: ['Mes', 'Valor'], column_meta: { Mes: { type: 'text', unique_values: ['Enero', 'Febrero'] }, Valor: { type: 'number', unique_values: [500, 1000] } },
      preview: [{ Mes: 'Enero', Valor: 500 }, { Mes: 'Febrero', Valor: 1000 }], raw_preview: [['Mes', 'Valor'], ['Enero', 500]], warnings: [],
    };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return state;
}

test('save, choose viewers, open from menu and reload the direct link', async ({ page }) => {
  const state = await mockSystem(page);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/generador');
  await page.getByLabel('Archivos disponibles').selectOption('file');
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('indicator');
  await page.getByLabel('Nombre del tablero').fill('Ingresos semanales');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Usuarios con acceso' }).fill('Bruno');
  await page.getByRole('option', { name: 'Bruno' }).click();
  await dialog.getByRole('combobox', { name: 'Usuarios con acceso' }).press('Escape');
  await page.screenshot({ path: 'test-results/save-access-dialog.png' });
  await dialog.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await expect(page.getByRole('link', { name: 'Ver tablero', exact: true })).toBeVisible();
  expect(state.recipients).toEqual(['owner', 'reader']);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'Ingresos semanales', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresos semanales', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Gráficos', exact: true }).click();
  await expect(page.locator('.saved-dashboard h1')).toHaveText('Gráficos');
  await expect(page.locator('.generator-indicator strong')).toBeVisible();
  await page.goto('/ingresos-semanales/graficos');
  await page.reload();
  await expect(page.locator('.saved-dashboard h1')).toHaveText('Gráficos');
  await expect(page.locator('.generator-indicator strong')).toBeVisible();
  await page.screenshot({ path: 'test-results/saved-dashboard.png', fullPage: true });
  await page.getByRole('link', { name: 'Editar gráficos y accesos' }).click();
  await expect(page.getByLabel('Nombre del tablero')).toHaveValue('Ingresos semanales');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Bruno', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('previous saved workspaces are recovered into the same menu without recreating charts', async ({ page }) => {
  const state = await mockSystem(page, { old: true });
  await page.goto('/generador');
  await expect(page.getByRole('status')).toContainText('1 tablero recuperado');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'Ingresos semanales', exact: true }).click();
  await page.getByRole('link', { name: 'Gráficos', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  expect(state.saves).toBe(0);
});

test('shared viewer has a reading view and revoked access clears the graphs', async ({ page }) => {
  const state = await mockSystem(page, { viewer: true });
  const requests: string[] = []; page.on('request', r => requests.push(r.url()));
  await page.goto('/ingresos-semanales/graficos');
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  await expect(page.getByRole('link', { name: 'Editar gráficos y accesos' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('button', { name: 'USUARIOS', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'TABLEROS', exact: true })).toHaveCount(0);
  expect(requests.some(url => url.includes('/v2/sources'))).toBe(false);
  state.revoked = true;
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('no tenés acceso');
  await expect(page.locator('.generator-indicator strong')).toHaveCount(0);
});

test('publication errors keep the dialog and selected users for a safe retry', async ({ page }) => {
  const state = await mockSystem(page, { failPublish: true });
  await page.goto('/generador');
  await page.getByLabel('Archivos disponibles').selectOption('file');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Usuarios con acceso' }).fill('Bruno');
  await page.getByRole('option', { name: 'Bruno' }).click();
  await dialog.getByRole('combobox', { name: 'Usuarios con acceso' }).press('Escape');
  await dialog.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Los gráficos quedaron guardados');
  await expect(dialog.getByText('Bruno', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await expect(page.getByRole('link', { name: 'Ver tablero', exact: true })).toBeVisible();
  expect(state.workspaces).toHaveLength(1);
  expect(state.recipients).toEqual(['owner', 'reader']);
});

test('the existing Users screen grants generated sections and retains the dialog on failure', async ({ page }) => {
  const state = await mockSystem(page, { old: true });
  state.published = true;
  await page.route('**/user/get-all', route => route.fulfill({ json: { data: [{ _id: 'reader', username: 'Bruno', email: 'bruno@example.test', profileType: 'INVITADO', access: [] }] } }));
  let submitted: any;
  await page.route('**/user/access/reader', route => { submitted = route.request().postDataJSON(); return route.fulfill({ status: 503, json: { error: 'No se pudieron guardar los accesos.' } }); });
  await page.goto('/usuarios');
  await page.getByRole('button', { name: 'Accesos de Bruno' }).click();
  const dialog = page.getByRole('dialog', { name: 'Gestionar Accesos' });
  await dialog.getByRole('checkbox', { name: 'Acceso', exact: true }).check();
  await dialog.getByRole('button', { name: 'Secciones de Ingresos semanales' }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Gráficos' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('No se pudieron guardar los accesos');
  expect(submitted.access).toEqual([{ dashboard: 'dashboard', sections: ['section'] }]);
  await expect(dialog.getByRole('checkbox', { name: 'Gráficos' })).toBeChecked();
});
