import { test, expect } from '@playwright/test';
const preview = {
  columns: ['Mes', 'Valor'], column_meta: { Mes: { type: 'number', unique_values: [1, 2, 3], unique_count: 3, missing: 0, invalid: 0 }, Valor: { type: 'number', unique_values: [0, 10, 5], unique_count: 3, missing: 0, invalid: 0 } },
  row_count: 3, preview: [{ Mes: 1, Valor: 0 }, { Mes: 2, Valor: 10 }, { Mes: 3, Valor: 5 }], raw_preview: [['Mes', 'Valor'], [1, 0], [2, 10]], warnings: [],
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('user', JSON.stringify({ _id: 'test', username: 'Prueba', profileType: 'INVITADO', access_token: 'test-only' })));
  const saved: any[] = [];
  await page.route(/:(3000|8000)\//, async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = { status: 200, data: [] };
    if (path === '/v2/workspaces/restore-menu') data = { restored: 0 };
    else if (path === '/v2/google/status') data = { client_id: '', public_access: false };
    else if (path === '/v2/publication-options' || path.endsWith('/publication')) data = { published: path.endsWith('/publication'), canShare: false, currentUserId: 'test', canView: true, users: [], recipientIds: [], path: '/tablero-semanal/graficos', show: true };
    else if (path === '/v2/workspaces/saved') data = saved[0];
    else if (path === '/v2/sources') data = [{ _id: 'test-source', name: 'Prueba.csv', kind: 'upload' }];
    else if (path === '/v2/workspaces' && route.request().method() === 'GET') data = saved;
    else if (path === '/v2/workspaces') { data = { _id: 'saved', ...route.request().postDataJSON() }; saved.push(data); }
    else if (path.endsWith('/sheets')) data = ['Datos'];
    else if (path.endsWith('/preview')) data = preview;
    else if (path.endsWith('/chart')) {
      const cfg = route.request().postDataJSON();
      data = { labels: [1, 2, 3], datasets: [{ label: 'Valor', data: [0, 10, 5], x: [1, 2, 3] }], filtered_rows: 3, warnings: [], columns: preview.columns, records: preview.preview };
      if (cfg.chart_type === 'indicator') data = { labels: ['Total'], datasets: [{ label: 'Total', data: [15] }], filtered_rows: 3, warnings: [] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/generador');
  await expect(page.getByRole('heading', { name: 'Generador de gráficos' })).toBeVisible();
  await page.getByLabel('Archivos disponibles').selectOption('test-source');
  await expect(page.getByText('3 filas · 2 columnas.', { exact: false })).toBeVisible();
});

test('all chart types render in both libraries', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const types = ['bar', 'horizontal', 'stacked', 'line', 'area', 'scatter', 'pie', 'donut', 'histogram', 'box', 'heatmap', 'table', 'indicator'];
  for (const library of ['Plotly', 'ECharts']) {
    await page.getByRole('combobox', { name: 'Presentación', exact: true }).selectOption(library);
    for (const kind of types) {
      await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption(kind);
      await page.getByRole('combobox', { name: 'Valor / eje Y', exact: true }).selectOption('Valor');
      await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
      await expect(page.getByText('3 registros', { exact: false })).toBeVisible();
      if (kind === 'table') await expect(page.locator('.generator-widget table')).toBeVisible();
      else if (kind === 'indicator') await expect(page.locator('.generator-indicator strong')).toHaveText('15');
      // The first render also loads the plotting library through Vite in this development test.
      else if (library === 'Plotly') await expect(page.locator('.js-plotly-plot .main-svg').first()).toBeVisible({ timeout: 15000 });
      else await expect(page.locator('.generator-widget canvas').first()).toBeVisible({ timeout: 15000 });
    }
  }
  expect(errors).toEqual([]);
  await page.getByRole('combobox', { name: 'Presentación', exact: true }).selectOption('Plotly');
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('bar');
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.js-plotly-plot')).toBeVisible();
  await page.screenshot({ path: 'test-results/generator-preview.png', fullPage: true });
});

test('filters invalidate previous results and saved configuration includes layout', async ({ page }) => {
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.js-plotly-plot')).toBeVisible();
  await page.getByLabel('Mes', { exact: true }).fill('2');
  await expect(page.locator('.js-plotly-plot')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Ancho', exact: true }).selectOption('6');
  await page.getByLabel('Nombre del tablero').fill('Tablero semanal');
  const request = page.waitForRequest(r => r.url().endsWith('/v2/workspaces') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  const body = (await request).postDataJSON();
  expect(body.widgets[0].width).toBe(6);
  expect(body.widgets[0].config.filters.Mes).toEqual(['2']);
  expect(body.name).toBe('Tablero semanal');
  await expect(page.getByRole('status')).toContainText('Tablero guardado');
  await page.reload();
  await page.getByLabel('Tableros guardados').selectOption('saved');
  await expect(page.getByLabel('Nombre del tablero')).toHaveValue('Tablero semanal');
  await expect(page.getByRole('combobox', { name: 'Ancho', exact: true })).toHaveValue('6');
  await expect(page.getByLabel('Mes', { exact: true })).toHaveValue('2');
});

test('shows an API error without displaying a stale chart', async ({ page }) => {
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.js-plotly-plot')).toBeVisible();
  await page.route('**/v2/sources/test-source/chart', route => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: 'La columna contiene texto.' }) }));
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.generator-widget').getByRole('alert')).toHaveText('La columna contiene texto.');
  await expect(page.locator('.js-plotly-plot')).toHaveCount(0);
});
