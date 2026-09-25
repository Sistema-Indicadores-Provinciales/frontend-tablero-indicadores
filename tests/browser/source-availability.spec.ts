import { test, expect, Page } from '@playwright/test';

const file = { _id: 'file', name: 'Disponible.csv', kind: 'upload' };
const sheet = { _id: 'google', name: 'Hoja privada', kind: 'google' };
const replacement = { _id: 'replacement', name: 'Recuperado.csv', kind: 'upload' };
const config = { sheet: 'Datos', header_row: 1, decimal: ',', types: {}, chart_type: 'indicator', aggregation: 'sum', x_col: 'Mes', y_col: 'Valor', group_col: '', date_bucket: 'none', filters: { Mes: ['1'] } };
const preview = { columns: ['Mes', 'Valor'], column_meta: { Mes: { type: 'number', unique_values: [1], unique_count: 1 }, Valor: { type: 'number', unique_values: [10], unique_count: 1 } },
  row_count: 1, preview: [{ Mes: 1, Valor: 10 }], raw_preview: [['Mes', 'Valor'], [1, 10]], warnings: [] };

async function setup(page: Page) {
  const state = { sources: [file, sheet], failure: '', googleDenied: false, reads: [] as string[], saves: [] as any[],
    workspace: { _id: 'saved', name: 'Tablero conservado', source_id: 'missing-file', widgets: [{ id: 'chart-a', title: 'Total conservado', width: 6, library: 'Plotly', config }] } };
  await page.addInitScript(() => localStorage.setItem('user', JSON.stringify({ _id: 'test', username: 'Prueba', profileType: 'INVITADO', access_token: 'test-only' })));
  await page.route(/:(3000|8000)\//, async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let data: any = { data: [] }, status = 200;
    if (path === '/v2/workspaces/restore-menu') data = { restored: 0 };
    else if (path === '/v2/sources') data = state.sources;
    else if (path === '/v2/sources/upload') { state.sources.push(replacement); data = replacement; }
    else if (path === '/v2/google/status') data = { client_id: '', public_access: true };
    else if (path === '/v2/workspaces') data = [state.workspace];
    else if (path === '/v2/workspaces/saved') {
      if (request.method() === 'PUT') { state.saves.push(request.postDataJSON()); state.workspace = { _id: 'saved', ...request.postDataJSON() }; }
      data = state.workspace;
    }
    else if (path.endsWith('/publication') || path === '/v2/publication-options') data = { canShare: false, currentUserId: 'test', canView: true, users: [], recipientIds: [], path: '/conservado/graficos', show: true };
    else if (/\/v2\/sources\/[^/]+\/(sheets|preview|chart)$/.test(path)) {
      state.reads.push(path);
      if (path.endsWith('/' + state.failure) && path.includes('/file/')) { status = 404; data = { detail: 'El archivo no está disponible en este servidor.' }; }
      else if (state.googleDenied && path.includes('/google/')) { status = 409; data = { detail: 'Conectá tu cuenta de Google para leer la hoja.' }; }
      else if (path.endsWith('/sheets')) data = ['Datos'];
      else if (path.endsWith('/preview')) data = preview;
      else data = { labels: ['Total'], datasets: [{ label: 'Total', data: [10] }], filtered_rows: 1, warnings: [] };
    }
    await route.fulfill({ status, json: data });
  });
  return state;
}

async function open(page: Page, url = '/generador') {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Generador de gráficos', exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByLabel('Archivos disponibles')).toBeEnabled();
}

test('refresh removes a disappeared source and its chart without selecting another file', async ({ page }) => {
  const state = await setup(page);
  await open(page);
  await page.getByLabel('Archivos disponibles').selectOption('file');
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('indicator');
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('10');
  state.sources = [sheet];
  await page.getByRole('button', { name: 'Actualizar lista', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El archivo seleccionado ya no está disponible');
  await expect(page.getByLabel('Archivos disponibles')).toHaveValue('');
  await expect(page.getByLabel('Archivos disponibles').locator('option')).toHaveText(['Elegir fuente', 'Hoja privada (Google Sheets)']);
  await expect(page.locator('.generator-indicator')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Guardar tablero', exact: true })).toHaveCount(0);
  // Restoring the volume and refreshing makes the original selection usable again.
  state.sources = [file, sheet];
  await page.getByRole('button', { name: 'Actualizar lista', exact: true }).click();
  await expect(page.getByLabel('Archivos disponibles')).toHaveValue('file');
  await expect(page.getByText('1 filas · 2 columnas.', { exact: false })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const phase of ['sheets', 'preview', 'chart']) {
  test(`file disappearing during ${phase} is removed from choices`, async ({ page }) => {
    const state = await setup(page);
    state.failure = phase;
    await open(page);
    await page.getByLabel('Archivos disponibles').selectOption('file');
    if (phase === 'chart') await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Volvé a subir el archivo o elegí otra fuente');
    await expect(page.getByLabel('Archivos disponibles').locator('option[value="file"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Guardar tablero', exact: true })).toHaveCount(0);
    await page.getByLabel('Archivos disponibles').selectOption('google');
    await expect(page.getByText('1 filas · 2 columnas.', { exact: false })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('missing saved source can be replaced without losing chart settings or filters', async ({ page }) => {
  const state = await setup(page);
  await open(page, '/generador?editar=saved');
  await expect(page.getByRole('alert')).toContainText('Conservamos la configuración de tus gráficos');
  await expect(page.getByLabel('Archivos disponibles')).toHaveValue('');
  expect(state.reads.filter(path => path.includes('/missing-file/'))).toEqual([]);
  await page.screenshot({ path: 'test-results/missing-saved-source.png', fullPage: true });
  await page.getByLabel('Subir archivo', { exact: true }).setInputFiles({ name: 'Recuperado.csv', mimeType: 'text/csv', buffer: Buffer.from('Mes,Valor\n1,10') });
  await expect(page.getByLabel('Nombre del tablero')).toHaveValue('Tablero conservado');
  await expect(page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true })).toHaveValue('indicator');
  await expect(page.getByLabel('Mes', { exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await expect(page.getByText('Tablero guardado. Ya aparece', { exact: false })).toBeVisible();
  expect(state.saves).toHaveLength(1);
  expect(state.saves[0].source_id).toBe('replacement');
  expect(state.saves[0].widgets[0]).toMatchObject({ id: 'chart-a', title: 'Total conservado', width: 6, config });
});

test('a late preview cannot bring back a file removed by refresh', async ({ page }) => {
  const state = await setup(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let received = false;
  await page.route('**/v2/sources/file/preview', async route => {
    received = true;
    await pending;
    await route.fulfill({ json: preview });
  });
  await open(page);
  await page.getByLabel('Archivos disponibles').selectOption('file');
  await expect.poll(() => received).toBe(true);
  state.sources = [sheet];
  await page.getByRole('button', { name: 'Actualizar lista', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El archivo seleccionado ya no está disponible');
  release();
  await page.getByLabel('Archivos disponibles').selectOption('google');
  await expect(page.getByRole('heading', { name: '2. Revisar la lectura · Hoja privada', exact: true })).toBeVisible();
  await expect(page.getByText('1 filas · 2 columnas.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Archivos disponibles')).toHaveValue('google');
});

test('empty library offers upload and Sheets, while Google authorization errors retain the linked sheet', async ({ page }) => {
  const state = await setup(page);
  state.sources = [];
  await open(page);
  await expect(page.getByText('Todavía no hay fuentes disponibles.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Subir archivo', { exact: true })).toBeEnabled();
  state.sources = [sheet]; state.googleDenied = true;
  await page.getByRole('button', { name: 'Actualizar lista', exact: true }).click();
  await page.getByLabel('Archivos disponibles').selectOption('google');
  await expect(page.getByRole('alert')).toContainText('Conectá tu cuenta de Google');
  await expect(page.getByLabel('Archivos disponibles')).toHaveValue('google');
  await expect(page.getByLabel('Archivos disponibles').locator('option[value="google"]')).toHaveCount(1);
});
