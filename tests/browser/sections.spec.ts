import { test, expect, Page } from '@playwright/test';

const did = 'a'.repeat(24), sid = 'b'.repeat(24);
async function system(page: Page, { emptySection = false, guest = false } = {}) {
  const target = { dashboardId: did, sectionId: sid, dashboardName: 'Equipamiento médico', sectionName: 'Inventario', path: '/equipamiento/inventario' };
  const state = { created: emptySection, workspace: null as any, recipients: ['owner', 'reader'], createFailure: false,
    creationRequests: [] as any[], saves: [] as any[], publicationFailure: false };
  const userId = guest ? 'reader' : 'owner';
  const board = () => ({ _id: did, name: target.dashboardName, keyname: 'equipamiento', icon: 'material-symbols:medical-services', show: true,
    sections: state.created ? [{ _id: sid, name: target.sectionName, keyname: 'inventario', show: true, ...(state.workspace?.published ? { workspaceId: 'saved' } : {}) }] : [] });
  const options = () => ({ published: !!state.workspace?.published, canShare: !guest, currentUserId: userId,
    users: [{ _id: 'owner', username: 'Ana' }, { _id: 'reader', username: 'Bruno' }], recipientIds: state.recipients,
    destinations: state.created && !state.workspace?.published ? [target] : [],
    ...(state.workspace?.published ? { destination: target, path: target.path, canView: true, show: true } : {}) });
  await page.addInitScript(({ userId, guest }) => localStorage.setItem('user', JSON.stringify({ _id: userId, username: guest ? 'Bruno' : 'Ana', profileType: guest ? 'INVITADO' : 'ADMIN', access_token: 'test' })), { userId, guest });
  await page.route(/:(3000|8000)\//, async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    let data: any = { data: [] }, status = 200;
    if (path === '/dashboard/get-all') data = { data: [board()] };
    else if (path === '/user/my-dashboards') data = { data: [{ ...board(), sections: state.created && state.recipients.includes(userId) ? ['inventario'] : [] }] };
    else if (path.endsWith('/section-options')) data = { ...options(), dashboardName: target.dashboardName };
    else if (path === `/v2/dashboards/${did}/sections` && method === 'POST') {
      state.creationRequests.push(request.postDataJSON());
      if (state.createFailure) { status = 503; data = { detail: 'No se pudo completar la creación.' }; }
      else { state.created = true; state.recipients = request.postDataJSON().recipientIds; data = { ...target, canView: true }; }
    }
    else if (path === `/v2/dashboards/${did}/sections/${sid}/options`) data = { ...options(), ...target, canAddCharts: !state.workspace?.published, workspaceId: state.workspace?.published ? 'saved' : null };
    else if (path === '/v2/publication-options' || path === '/v2/workspaces/saved/publication') {
      if (method === 'PUT') {
        if (state.publicationFailure) { status = 503; data = { detail: 'No se pudieron guardar los accesos.' }; }
        else { state.workspace.published = true; state.recipients = request.postDataJSON().recipientIds; data = options(); }
      } else data = options();
    }
    else if (path === '/v2/workspaces/restore-menu') data = { restored: 0 };
    else if (path === '/v2/workspaces' || path === '/v2/workspaces/saved') {
      if (method === 'POST' || method === 'PUT') { state.saves.push(request.postDataJSON()); state.workspace = { ...state.workspace, _id: 'saved', ...request.postDataJSON() }; }
      data = method === 'GET' && path === '/v2/workspaces' ? state.workspace ? [state.workspace] : [] : state.workspace;
    }
    else if (path === '/v2/workspaces/saved/view') data = { ...state.workspace, can_edit: !guest, source_kind: state.workspace?.source_id === 'google-source' ? 'google' : 'upload', source_access_mode: state.workspace?.source_id === 'google-source' ? 'public' : undefined };
    else if (path === '/v2/sources') data = [{ _id: 'file', name: 'Inventario.csv', kind: 'upload' }];
    else if (path === '/v2/sources/upload') data = { _id: 'uploaded', name: 'Nuevo.csv', kind: 'upload' };
    else if (path === '/v2/sources/google') data = { _id: 'google-source', name: 'Hoja pública', kind: 'google', access_mode: 'public' };
    else if (path === '/v2/google/status') data = { client_id: '', public_access: false };
    else if (path.endsWith('/chart')) data = { labels: ['Total'], datasets: [{ label: 'Total', data: [1500] }], filtered_rows: 2, warnings: [] };
    else if (path.endsWith('/sheets')) data = ['Datos'];
    else if (path.endsWith('/preview')) data = { row_count: 2, columns: ['Equipo', 'Cantidad'], column_meta: { Equipo: { type: 'text', unique_values: ['A', 'B'] }, Cantidad: { type: 'number', unique_values: [500, 1000] } }, preview: [{ Equipo: 'A', Cantidad: 500 }], raw_preview: [['Equipo', 'Cantidad']], warnings: [] };
    await route.fulfill({ status, json: data });
  });
  return state;
}

test('create section with readers, upload into it, save, reload and append a chart in the same section', async ({ page }) => {
  const state = await system(page);
  await page.goto('/equipamiento');
  await expect(page.getByRole('heading', { name: 'Equipamiento médico', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/empty-dashboard.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Agregar sección', exact: false }).click();
  const dialog = page.getByRole('dialog', { name: 'Agregar sección', exact: true });
  await dialog.getByRole('textbox', { name: 'Nombre de la sección' }).fill('Inventario');
  await dialog.getByRole('combobox', { name: 'Quién puede ver esta sección' }).fill('Bruno');
  await page.getByRole('option', { name: 'Bruno' }).click();
  await dialog.getByRole('combobox', { name: 'Quién puede ver esta sección' }).press('Escape');
  state.createFailure = true;
  await dialog.getByRole('button', { name: 'Crear sección', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('No se pudo completar');
  state.createFailure = false;
  await dialog.getByRole('button', { name: 'Crear sección', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agregando gráficos a Inventario' })).toBeVisible();
  expect(state.creationRequests[0].requestId).toBe(state.creationRequests[1].requestId);
  expect(state.recipients).toEqual(['owner', 'reader']);
  await page.getByLabel('Subir archivo', { exact: true }).setInputFiles({ name: 'Nuevo.csv', mimeType: 'text/csv', buffer: Buffer.from('Equipo,Cantidad\nA,500\nB,1000') });
  await expect(page.getByText('2 filas · 2 columnas.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agregando gráficos a Inventario' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('indicator');
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar en esta sección', exact: true }).click();
  const saveDialog = page.getByRole('dialog', { name: 'Guardar gráficos en la sección', exact: true });
  await expect(saveDialog.getByText('Bruno', { exact: true })).toBeVisible();
  state.publicationFailure = true;
  await saveDialog.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await expect(saveDialog.getByRole('alert').filter({ hasText: 'Los gráficos quedaron guardados' })).toBeVisible();
  state.publicationFailure = false;
  await saveDialog.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await page.getByRole('link', { name: 'Ver sección', exact: true }).click();
  await expect(page.locator('.saved-dashboard h1')).toHaveText('Inventario');
  await page.reload();
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  expect(state.workspace.destination).toEqual({ dashboardId: did, sectionId: sid });
  await page.getByRole('link', { name: 'Editar gráficos y accesos' }).click();
  await expect(page.getByRole('heading', { name: 'Agregando gráficos a Inventario' })).toBeVisible();
  await page.getByRole('button', { name: 'Agregar gráfico', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).last().selectOption('indicator');
  await page.getByRole('button', { name: 'Guardar en esta sección', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await page.getByRole('link', { name: 'Ver sección', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveCount(2);
  await page.getByRole('link', { name: 'Volver a Equipamiento médico', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Equipamiento médico', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Inventario', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-sections.png', animations: 'disabled' });
});

test('the general generator can choose an existing empty section without creating a dashboard', async ({ page }) => {
  const state = await system(page, { emptySection: true });
  await page.goto('/generador');
  await page.getByLabel('Archivos disponibles').selectOption('file');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('combobox', { name: 'Dónde guardar los gráficos' }).click();
  await page.getByRole('option', { name: 'Equipamiento médico → Inventario' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Bruno', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await expect(page.getByRole('link', { name: 'Ver sección', exact: true })).toBeVisible();
  expect(state.saves[0].destination).toEqual({ dashboardId: did, sectionId: sid });
});

test('empty sections give readers a clear empty state without opening an editor', async ({ page }) => {
  await system(page, { emptySection: true, guest: true });
  await page.goto('/equipamiento');
  await expect(page.getByRole('button', { name: 'Agregar sección', exact: false })).toHaveCount(0);
  await page.getByRole('link', { name: 'Inventario', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('todavía no tiene gráficos');
  await expect(page.getByRole('heading', { name: 'Generador de gráficos' })).toHaveCount(0);
});

test('public Sheets import keeps the selected section and saved charts need no Google connection', async ({ page }) => {
  const state = await system(page, { emptySection: true });
  await page.goto('/equipamiento/inventario');
  await expect(page.getByRole('heading', { name: 'Agregando gráficos a Inventario' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Enlace de Google Sheets' }).fill('https://docs.google.com/spreadsheets/d/' + 'a'.repeat(30) + '/edit#gid=42');
  await page.getByRole('button', { name: 'Usar hoja', exact: true }).click();
  await expect(page.getByText('2 filas · 2 columnas.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agregando gráficos a Inventario' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('indicator');
  await page.getByRole('button', { name: 'Guardar en esta sección', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await page.getByRole('link', { name: 'Ver sección', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  expect(state.workspace.destination).toEqual({ dashboardId: did, sectionId: sid });
  expect(state.workspace.source_id).toBe('google-source');
  await page.reload();
  await expect(page.locator('.generator-indicator strong')).toHaveText('1.500');
  await expect(page.getByText('Google Sheets · Enlace público.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conectar Google', exact: true })).toHaveCount(0);
});
