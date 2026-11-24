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
  await page.getByText('Limitar los datos guardados', { exact: false }).click();
  await page.getByLabel('Mes', { exact: true }).fill('2');
  await expect(page.locator('.js-plotly-plot')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Ancho', exact: true }).selectOption('6');
  await page.getByLabel('Nombre del tablero').fill('Tablero semanal');
  const request = page.waitForRequest(r => r.url().endsWith('/v2/workspaces') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  const body = (await request).postDataJSON();
  expect(body.widgets[0].width).toBe(6);
  expect(body.widgets[0].config.filter_rules).toContainEqual({ column: 'Mes', operator: 'in', value: '', values: ['2'] });
  expect(body.name).toBe('Tablero semanal');
  await expect(page.getByRole('status')).toContainText('Tablero guardado');
  await page.reload();
  await page.getByLabel('Tableros guardados').selectOption('saved');
  await expect(page.getByLabel('Nombre del tablero')).toHaveValue('Tablero semanal');
  await expect(page.getByRole('combobox', { name: 'Ancho', exact: true })).toHaveValue('6');
  await page.getByText('Restricciones de este gráfico', { exact: false }).click();
  await expect(page.getByRole('combobox', { name: 'Campo', exact: true })).toHaveValue('Mes');
  await expect(page.getByRole('textbox', { name: 'Valor', exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.js-plotly-plot')).toBeVisible();
});

test('allows additional metrics on compatible charts', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Valor / eje Y', exact: true }).selectOption('Valor');
  await page.getByRole('combobox', { name: 'Operación', exact: true }).selectOption('sum');
  const addMetric = page.getByRole('button', { name: 'Agregar otra métrica', exact: true });
  await expect(addMetric).toBeEnabled();
  await addMetric.click();
  await expect(page.getByRole('combobox', { name: 'Métrica adicional 1', exact: true })).toHaveValue('Mes');
  await expect(addMetric).toBeVisible();
  const request = page.waitForRequest(r => r.url().endsWith('/v2/sources/test-source/chart'));
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ y_col: 'Valor', y_cols: ['Mes'], aggregation: 'sum' });
  await expect(page.locator('.js-plotly-plot')).toBeVisible();
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('scatter');
  await expect(addMetric).toBeDisabled();
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('table');
  await page.getByLabel('Contenido de la tabla').selectOption('summary');
  await expect(page.getByRole('combobox', { name: 'Métrica adicional 1', exact: true })).toHaveValue('Mes');
  await expect(addMetric).toBeDisabled(); // Both available columns are already selected.
});

test('summary tables paginate every category and reset when regenerated', async ({ page }) => {
  await page.route('**/v2/sources/test-source/chart', route => route.fulfill({ json: {
    labels: [], datasets: [], filtered_rows: 1046, warnings: [], columns: ['Causa', 'Total'],
    records: Array.from({ length: 1046 }, (_, i) => ({ Causa: `Diagnóstico ${i + 1}`, Total: i + 1 })),
  } }));
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('table');
  await page.getByLabel('Contenido de la tabla').selectOption('summary');
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.generator-widget .generator-table tbody tr')).toHaveCount(100);
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Diagnóstico 1046', exact: true })).toBeVisible();
  await expect(page.locator('.generator-widget .generator-table tbody tr')).toHaveCount(46);
  await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Diagnóstico 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
});

test('editing preserves each chart source, sheet, numeric parsing and individual restrictions', async ({ page }) => {
  const population = { id: 'population', title: 'Población estimada', source_id: 'population-source', width: 6, library: 'ECharts',
    config: { sheet: 'TABLA', header_row: 1, decimal: '.', types: {}, chart_type: 'indicator', x_col: 'AÑO', y_col: 'POBLACION', aggregation: 'sum', filters: {} } };
  const deaths = { id: 'deaths', title: 'Defunciones masculinas', width: 6, library: 'ECharts',
    config: { sheet: 'CAUSAS', header_row: 2, decimal: ',', types: { TOTAL: 'number' }, chart_type: 'indicator', x_col: 'AÑO', y_col: 'TOTAL', aggregation: 'sum',
      computed_columns: { Causa: [{ column: 'CAUSA', case: 'lower' }] }, filters: {}, filter_rules: [{ column: 'GENERO', operator: 'equal', value: 'Masculino' }] } };
  const workspace = { _id: 'migration', name: 'Salud', source_id: 'test-source', widgets: [population, deaths], filter_columns: ['AÑO', 'Causa'], filter_option_rules: [{ column: 'CAUSA', operator: 'not_contains', value: 'TASA' }], default_filters: { AÑO: ['2025'] }, column_aliases: { POBLACION: 'Habitantes', Causa: 'Causa normalizada' } };
  await page.route('**/v2/workspaces/migration', async route => route.fulfill({ json: route.request().method() === 'GET' ? workspace : { ...workspace, ...route.request().postDataJSON() } }));
  await page.route('**/v2/sources/*/preview', route => {
    const isPopulation = route.request().url().includes('/population-source/');
    const columns = isPopulation ? ['AÑO', 'POBLACION'] : ['AÑO', 'TOTAL', 'GENERO', 'CAUSA', 'Causa'];
    return route.fulfill({ json: { columns, column_meta: Object.fromEntries(columns.map(c => [c, { type: 'number', unique_values: [1], unique_count: 1 }])), row_count: 1, preview: [], raw_preview: [], warnings: [] } });
  });
  await page.route('**/v2/sources/test-source/sheets', route => route.fulfill({ json: ['CAUSAS', 'OTRA'] }));
  await page.route('**/v2/sources/population-source/chart', route => route.fulfill({ json: { labels: ['Total'], datasets: [{ label: 'Total', data: [617334] }], filtered_rows: 12, warnings: [] } }));
  await page.goto('/generador?editar=migration');
  await expect(page.getByLabel('Nombre del tablero')).toHaveValue('Salud');
  await expect(page.getByRole('combobox', { name: 'Valor / eje Y', exact: true }).first()).toHaveValue('POBLACION');
  await expect(page.getByRole('combobox', { name: 'Valor / eje Y', exact: true }).last()).toHaveValue('TOTAL');
  const generation = page.waitForRequest(r => r.url().endsWith('/population-source/chart'));
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).first().click();
  expect((await generation).postDataJSON()).toMatchObject(population.config);
  await expect(page.locator('.generator-indicator strong')).toHaveText('617.334');
  const saving = page.waitForRequest(r => r.url().endsWith('/workspaces/migration') && r.method() === 'PUT');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  const body = (await saving).postDataJSON();
  expect(body.widgets[0]).toMatchObject(population);
  expect(body.widgets[1]).toMatchObject(deaths);
  expect(body.default_filters).toEqual({ AÑO: ['2025'] });
  expect(body.column_aliases).toMatchObject(workspace.column_aliases);
  expect(body.filter_option_rules).toEqual(workspace.filter_option_rules);
});

test('migrated indicators preserve formulas, published text and percentage formatting when saved', async ({ page }) => {
  const base = { sheet: 'Datos', header_row: 1, decimal: ',', types: {}, chart_type: 'indicator', x_col: 'Mes', y_col: 'Valor', aggregation: 'sum', filters: {} };
  const widgets = [
    { id: 'ratio', title: 'Cobertura', width: 6, library: 'ECharts', config: { ...base, indicator_ratio: { denominator: 'Mes', scale: 100 }, indicator_decimals: 0, indicator_suffix: '%' } },
    { id: 'text-rate', title: 'Tasa publicada', width: 6, library: 'ECharts', config: { ...base, indicator_text_column: 'Valor' } },
    { id: 'conditional', title: 'Suma condicional', width: 6, library: 'ECharts', config: { ...base, indicator_sum_rules: [{ column: 'Mes', operator: 'equal', value: '1' }], filter_rules: [{ column: 'Mes', operator: 'greater_equal', value: '1' }] } },
    { id: 'daily', title: 'Suma de columnas', width: 6, library: 'ECharts', config: { ...base, indicator_addends: ['Mes'] } },
    { id: 'lookup', title: 'Valor por año', width: 6, library: 'ECharts', config: { ...base, indicator_lookup: { column: 'Mes', values: { '1': 61 } }, indicator_empty: 'zero' } },
    { id: 'summary', title: 'Resumen', width: 12, library: 'ECharts', config: { ...base, chart_type: 'table', table_mode: 'summary', table_dimensions: ['Mes'], table_sorts: [{ field: 'Valor', aggregation: 'sum', direction: 'desc' }], preserve_empty_categories: true } },
    { id: 'coverage', title: 'Cobertura calendario', width: 6, library: 'ECharts', config: { ...base, indicator_single_value_columns: ['Mes'], value_format: 'percent' } },
    { id: 'variation', title: 'Variación mensual', width: 12, library: 'Plotly', config: { ...base, chart_type: 'line', value_format: 'percent_points',
      aggregate_join: { sheet: 'Anterior', keys: ['Mes'], left_sums: ['Valor'], right_sums: { Anterior: 'Valor' } },
      metric_ratio: { denominator: 'Anterior', subtract_denominator: true, scale: 100, series_order: 'desc' } } },
    { id: 'large-sheet', title: 'Atenciones por cobertura', width: 6, library: 'ECharts', config: { ...base,
      google_summary: { dimensions: ['Mes'], counts: { Valor: 'Paciente' }, max_values: {}, row_count: 'Registros' } } },
    { id: 'tied-pie', title: 'Categorías empatadas', width: 6, library: 'ECharts', config: { ...base, chart_type: 'pie',
      category_limit: 20, include_other: true, category_sort: { field: 'Valor', aggregation: 'max', direction: 'desc', tie_breaker: 'source_heap' } } },
  ];
  const workspace = { _id: 'formulas', source_id: 'test-source', name: 'Fórmulas de Salud', widgets, filter_columns: ['Mes'] };
  await page.route('**/v2/workspaces/formulas', route => route.fulfill({ json: route.request().method() === 'GET' ? workspace : { ...workspace, ...route.request().postDataJSON() } }));
  await page.route('**/v2/sources/test-source/chart', route => route.fulfill({ json: route.request().postDataJSON().indicator_text_column
    ? { labels: [], datasets: [], indicator_text: '7,30%', filtered_rows: 1, warnings: [] }
    : { labels: ['Total'], datasets: [{ label: 'Total', data: [route.request().postDataJSON().value_format === 'percent' ? 0.9618 : 37.15360091555628] }], filtered_rows: 1, warnings: [] } }));
  await page.goto('/generador?editar=formulas');
  await expect(page.getByLabel('Nombre del tablero')).toHaveValue('Fórmulas de Salud');
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).nth(0).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('37%');
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).nth(1).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText(['37%', '7,30%']);
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).nth(6).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText(['37%', '7,30%', '96,18 %']);
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).nth(7).click();
  await expect(page.locator('.js-plotly-plot')).toBeVisible();
  await expect(page.locator('.ytick')).toContainText(['%']);
  const saving = page.waitForRequest(r => r.url().endsWith('/workspaces/formulas') && r.method() === 'PUT');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  const body = (await saving).postDataJSON();
  widgets.forEach((widget, index) => expect(body.widgets[index]).toMatchObject(widget));
});

test('pie charts keep category labels outside and values inside each slice', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('pie');
  const labelMode = page.getByRole('combobox', { name: 'Valor dentro de cada porción', exact: true });
  await expect(labelMode).toHaveValue('percent');

  let request = page.waitForRequest(r => r.url().endsWith('/v2/sources/test-source/chart'));
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ chart_type: 'pie', pie_label_mode: 'percent' });
  await expect(page.locator('.pielayer')).toContainText('66,67 %');
  await expect(page.locator('.pielayer')).toContainText('2');

  await page.locator('.pielayer .trace').last().locator('.slice path').nth(1).hover();
  await expect(page.locator('.hoverlayer')).toContainText('2: 10 (66,67 %)');
  await expect(page.locator('.hoverlayer tspan').filter({ hasText: '2: 10 (66,67 %)' })).toHaveCSS('font-weight', '700');

  await labelMode.selectOption('value');
  request = page.waitForRequest(r => r.url().endsWith('/v2/sources/test-source/chart'));
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ chart_type: 'pie', pie_label_mode: 'value' });
  await expect(page.locator('.pielayer')).toContainText('10');

  await labelMode.selectOption('percent');
  await page.getByRole('combobox', { name: 'Presentación', exact: true }).selectOption('ECharts');
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.generator-widget canvas')).toBeVisible();
});

test('shows an API error without displaying a stale chart', async ({ page }) => {
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.js-plotly-plot')).toBeVisible();
  await page.route('**/v2/sources/test-source/chart', route => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: 'La columna contiene texto.' }) }));
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.generator-widget').getByRole('alert')).toHaveText('La columna contiene texto.');
  await expect(page.locator('.js-plotly-plot')).toHaveCount(0);
});

test('map configuration supports points and proportional circles', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('map');
  await expect(page.getByRole('combobox', { name: 'Presentación', exact: true })).toHaveValue('Google Maps');
  await page.getByRole('combobox', { name: 'Latitud', exact: true }).selectOption('Mes');
  await page.getByRole('combobox', { name: 'Longitud', exact: true }).selectOption('Valor');
  await page.getByRole('combobox', { name: 'Representación', exact: true }).selectOption('circles');
  await page.getByRole('combobox', { name: 'Tamaño de los círculos', exact: true }).selectOption('Valor');
  const addMetric = page.getByRole('button', { name: 'Agregar otra métrica', exact: true });
  await expect(addMetric).toBeEnabled();
  await addMetric.click();
  await expect(page.getByRole('combobox', { name: 'Métrica del mapa 1', exact: true })).toHaveValue('Mes');
  const request = page.waitForRequest(r => r.url().endsWith('/v2/sources/test-source/chart'));
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  const config = (await request).postDataJSON();
  expect(config).toMatchObject({ chart_type: 'map', latitude_col: 'Mes', longitude_col: 'Valor', map_mode: 'circles', size_col: 'Valor', map_metric_cols: ['Mes'] });
  await expect(page.getByText('No hay coordenadas válidas para los filtros seleccionados.')).toBeVisible();
});

test('verified maps retain their catalogue and expose unmatched values without inventing points', async ({ page }) => {
  const config = { sheet: 'Datos', header_row: 1, decimal: ',', types: {}, chart_type: 'map', x_col: 'Mes', y_col: 'Valor', aggregation: 'sum',
    map_lookup: { column: 'Mes', locations: { '1': { lat: -26.18, lng: -58.17, name: 'Ubicación verificada', reference: 'Catálogo de prueba' } }, sized: true },
    filter_rules: [{ column: 'Valor', operator: 'not_equal', value: '0' }] };
  const workspace = { _id: 'verified-map', name: 'Mapa de Salud', source_id: 'test-source', filter_columns: ['Mes'],
    widgets: [{ id: 'map', title: 'Casos por localidad', width: 12, library: 'ECharts', config }] };
  await page.route('**/v2/workspaces/verified-map', route => route.fulfill({ json: route.request().method() === 'GET' ? workspace : { ...workspace, ...route.request().postDataJSON() } }));
  // An unmatched selection must remain inspectable even if the map provider is unavailable.
  await page.route('**/maps.googleapis.com/**', route => route.abort());
  await page.route('**/v2/sources/test-source/chart', route => route.fulfill({ json: {
    labels: [], datasets: [], filtered_rows: 1, warnings: [], columns: ['Mes', 'Valor'],
    records: [{ Mes: 'Pendiente', Valor: 7 }], map_points: [], map_unlocated: [{ Mes: 'Pendiente', Valor: 7 }],
  } }));
  await page.goto('/generador?editar=verified-map');
  await expect(page.getByLabel('Nombre del tablero')).toHaveValue('Mapa de Salud');
  await expect(page.getByLabel('Latitud', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Valor del mapa')).toHaveValue('Valor');
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.getByText('0 ubicaciones verificadas · 1 grupos sin ubicación puntual')).toBeVisible();
  await page.getByText('Ver detalle por ubicación', { exact: true }).click();
  await expect(page.getByRole('row', { name: 'Pendiente 7', exact: true })).toBeVisible();
  const saving = page.waitForRequest(r => r.url().endsWith('/workspaces/verified-map') && r.method() === 'PUT');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  expect((await saving).postDataJSON().widgets[0].config).toMatchObject(config);
});
