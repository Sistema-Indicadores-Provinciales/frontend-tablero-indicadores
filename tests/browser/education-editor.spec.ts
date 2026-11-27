import { test, expect, Page } from '@playwright/test';
import { applyEditorChanges, editorResponse } from './editorTestApi';

const columns = ['AÑO', 'DELEGACION', 'NUNCA ASISTIERON', 'MATRICULA', 'PORCENTAJE', 'GESTION'];
const preview = { row_count: 3, columns, column_meta: Object.fromEntries(columns.map(column => [column, {
  type: ['DELEGACION', 'GESTION'].includes(column) ? 'text' : 'number', unique_count: 3,
  unique_values: column === 'AÑO' ? [2024, 2025, 2026] : column === 'GESTION' ? ['ESTATAL', 'PRIVADA', 'OTRA'] : [1, 2, 3],
}])), preview: [{ AÑO: 2025, DELEGACION: 'A', 'NUNCA ASISTIERON': 1, MATRICULA: 2 }], raw_preview: [], warnings: [] };
const configuration = { sheet: 'Matrícula', header_row: 2, decimal: ',', types: { MATRICULA: 'number' }, chart_type: 'bar', x_col: 'DELEGACION', y_col: 'MATRICULA', aggregation: 'sum', filters: {}, future_option: { untouched: null } };

async function setup(page: Page, saved = true) {
  const state = { workspace: { _id: 'education', name: 'Sección de prueba', source_id: 'file-a', filter_columns: ['AÑO'],
    widgets: [{ id: 'chart', title: 'Matrícula', library: 'Plotly', width: 12, config: structuredClone(configuration) }] } as any,
    patches: [] as any[], posts: [] as any[], trials: [] as any[], reads: [] as any[], conflict: false };
  await page.addInitScript(() => localStorage.setItem('user', JSON.stringify({ _id: 'owner', username: 'Prueba', profileType: 'ADMIN', access_token: 'test' })));
  await page.route(/:(3000|8000)\//, async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    let data: any = { data: [] }, status = 200;
    if (path === '/v2/sources') data = [{ _id: 'file-a', name: 'Educación.xlsx', kind: 'upload' }, { _id: 'file-b', name: 'Otra fuente.xlsx', kind: 'upload' }];
    else if (path === '/v2/workspaces' && method === 'GET') data = saved ? [state.workspace] : [];
    else if (path === '/v2/workspaces' && method === 'POST') { state.posts.push(request.postDataJSON()); state.workspace = { _id: 'education', ...request.postDataJSON() }; data = editorResponse(state.workspace); }
    else if (path === '/v2/workspaces/education') {
      if (method === 'PATCH') {
        state.patches.push(request.postDataJSON());
        if (state.conflict) { status = 409; data = { detail: 'La sección cambió en otra edición. Conservá tu borrador.' }; }
        else { state.workspace = applyEditorChanges(state.workspace, request.postDataJSON()); data = editorResponse(state.workspace); }
      } else data = editorResponse(state.workspace);
    }
    else if (path.endsWith('/publication') || path === '/v2/publication-options') data = { published: saved, canShare: false, currentUserId: 'owner', users: [], recipientIds: ['owner'], canView: true, show: true, icon: 'material-symbols:bar-chart-rounded', path: '/prueba/graficos' };
    else if (path.endsWith('/sheets')) data = ['Matrícula', 'Porcentajes'];
    else if (path.endsWith('/preview')) { state.reads.push({ source: path, ...request.postDataJSON() }); data = preview; }
    else if (path.endsWith('/formula-trial')) { state.trials.push(request.postDataJSON()); data = { sample: true, sample_rows: 1, matching_rows: 1, values: [.5] }; }
    else if (path.endsWith('/chart')) {
      const config = request.postDataJSON();
      data = { labels: ['A', 'B'], datasets: [{ label: config.y_col, metric: config.y_col, data: [.5, .25] }], filtered_rows: 3, warnings: [] };
      if (config.chart_type === 'indicator') data = { labels: ['Total'], datasets: [{ label: config.y_col, data: [.5] }], filtered_rows: 3, warnings: [] };
      if (config.chart_type === 'table') data = { labels: [], datasets: [], filtered_rows: 3, warnings: [], columns: config.table_columns || columns, records: [{ AÑO: 2025, DELEGACION: 'A', MATRICULA: 2 }] };
    }
    await route.fulfill({ status, json: data });
  });
  await page.goto(saved ? '/generador?editar=education' : '/generador');
  if (!saved) await page.getByLabel('Archivos disponibles').selectOption('file-a');
  await expect(page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).first()).toBeVisible();
  return state;
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('new charts use ECharts and stored Plotly stays unchanged on no-op save', async ({ page }) => {
  const state = await setup(page);
  const original = structuredClone(state.workspace);
  await expect(page.getByRole('combobox', { name: 'Presentación', exact: true })).toHaveValue('Plotly');
  await save(page);
  expect(state.patches).toEqual([]);
  expect(state.workspace).toEqual(original);
  await page.getByRole('button', { name: 'Agregar gráfico', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Presentación', exact: true }).last()).toHaveValue('ECharts');
});

test('title-only writes one property and reopening preserves every original setting', async ({ page }) => {
  const state = await setup(page), original = structuredClone(state.workspace);
  await page.getByLabel('Título', { exact: true }).fill('Título editado');
  await save(page);
  expect(state.patches[0].changes).toEqual([{ action: 'set', widget: 'chart', path: ['title'], value: 'Título editado' }]);
  original.widgets[0].title = 'Título editado';
  expect(state.workspace).toEqual(original);
  await page.reload();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Título editado');
});

test('cancel discards calculated fields and applying untouched modals preserves absent defaults', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Campos calculados y condiciones', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar campo calculado' }).click();
  await page.getByLabel('Nombre del campo', { exact: true }).fill('Borrador');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Valor / eje Y', exact: true }).locator('option', { hasText: 'Borrador' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Campos calculados y condiciones', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar cálculos y condiciones' }).click();
  await page.getByRole('button', { name: 'Opciones del gráfico', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar opciones del gráfico' }).click();
  await save(page);
  expect(state.patches).toEqual([]);
});

test('guided quotient supports row and aggregate operands, sample, format and reopening', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Campos calculados y condiciones', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar campo calculado' }).click();
  await page.getByLabel('Nombre del campo', { exact: true }).fill('Tasa');
  await page.getByRole('combobox', { name: 'Configuración común', exact: true }).selectOption('quotient');
  await page.getByRole('combobox', { name: 'Operando 1', exact: true }).selectOption('NUNCA ASISTIERON');
  await page.getByRole('combobox', { name: 'Operando 2', exact: true }).selectOption('MATRICULA');
  await expect(page.getByRole('textbox', { name: 'Expresión', exact: true })).toHaveValue('[NUNCA ASISTIERON] / [MATRICULA]');
  await page.getByRole('combobox', { name: 'Formato común', exact: true }).selectOption('percent:2');
  await page.getByRole('button', { name: 'Probar expresión en muestra' }).click();
  await expect(page.getByRole('status')).toContainText('Muestra: 1 de 1');
  expect(state.trials[0].config.sheet).toBe('Matrícula');
  await page.getByRole('button', { name: 'Aplicar cálculos y condiciones' }).click();
  await page.getByRole('combobox', { name: 'Valor / eje Y', exact: true }).selectOption('Tasa');
  await page.getByRole('combobox', { name: 'Operación', exact: true }).selectOption('max');
  await save(page);
  expect(state.workspace.widgets[0].config.calculated_fields[0]).toMatchObject({ name: 'Tasa', mode: 'row', expression: '[NUNCA ASISTIERON] / [MATRICULA]' });
  await page.reload();
  await page.getByRole('button', { name: 'Campos calculados y condiciones', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Configuración común', exact: true })).toHaveValue('quotient');
  await page.getByRole('combobox', { name: 'Evaluar operando 1', exact: true }).selectOption('SUM');
  await page.getByRole('combobox', { name: 'Evaluar operando 2', exact: true }).selectOption('SUM');
  await expect(page.getByRole('combobox', { name: 'Evaluación', exact: true })).toHaveValue('aggregate');
  await expect(page.getByRole('textbox', { name: 'Expresión', exact: true })).toHaveValue('SUM([NUNCA ASISTIERON]) / SUM([MATRICULA])');
});

test('custom formula keeps original whitespace and a concurrent save keeps the draft', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Campos calculados y condiciones', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar campo calculado' }).click();
  await page.getByLabel('Nombre del campo', { exact: true }).fill('Personalizado');
  const expression = '  IF([MATRICULA] IS NULL, NULL, [MATRICULA] * 2)\n';
  await page.getByRole('textbox', { name: 'Expresión', exact: true }).fill(expression);
  await page.getByRole('button', { name: 'Aplicar cálculos y condiciones' }).click();
  await save(page);
  await page.getByRole('button', { name: 'Campos calculados y condiciones', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Expresión', exact: true })).toHaveValue(expression);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Borrador en conflicto');
  state.conflict = true;
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await expect(page.getByRole('dialog').getByRole('alert').filter({ hasText: 'La sección cambió' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Borrador en conflicto');
});

test('CASE editor keeps ordered text rules and optional single-filter defaults', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('combobox', { name: 'Selección de AÑO', exact: true }).selectOption('single');
  await page.getByRole('combobox', { name: 'Valores iniciales de AÑO' }).fill('2025');
  await page.getByRole('option', { name: '2025', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Campos calculados y condiciones', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar campo calculado' }).click();
  await page.getByLabel('Nombre del campo', { exact: true }).fill('Importe');
  await page.getByRole('combobox', { name: 'Configuración común', exact: true }).selectOption('case');
  const first = page.locator('fieldset').filter({ has: page.getByText('Condición 1', { exact: true }) }).last();
  await first.getByRole('combobox', { name: 'Campo de condición', exact: true }).selectOption('AÑO');
  await first.getByLabel('Comparar con', { exact: true }).fill('2024');
  await first.getByRole('combobox', { name: 'Resultado: tipo', exact: true }).selectOption('text');
  await first.getByLabel('Resultado', { exact: true }).fill('$ 61 M');
  await page.getByRole('button', { name: 'Agregar condición CASE' }).click();
  const second = page.locator('fieldset').filter({ has: page.getByText('Condición 2', { exact: true }) }).last();
  await second.getByRole('combobox', { name: 'Resultado: tipo', exact: true }).selectOption('text');
  await second.getByLabel('Resultado', { exact: true }).fill('$ 891 M');
  await page.getByRole('button', { name: 'Aplicar cálculos y condiciones' }).click();
  await save(page);
  const config = state.workspace.widgets[0].config;
  expect(config.calculated_fields[0].expression).toContain('WHEN [AÑO] = 2024 THEN "$ 61 M"\nWHEN [AÑO] = 2025 THEN "$ 891 M"');
  expect(state.workspace.filter_settings).toEqual({ AÑO: 'single' });
  expect(state.workspace.default_filters).toEqual({ AÑO: ['2025'] });
});

test('own exclusions and display conditions persist independently of value formulas', async ({ page }) => {
  const state = await setup(page);
  await page.getByText('Filtros propios del gráfico', { exact: true }).click();
  await page.getByRole('button', { name: 'Agregar filtro', exact: true }).click();
  await page.getByRole('combobox', { name: 'Campo del filtro propio', exact: true }).selectOption('GESTION');
  await page.getByRole('combobox', { name: 'Modo del filtro propio', exact: true }).selectOption('exclude');
  await page.getByRole('combobox', { name: 'Valores del filtro propio' }).fill('PRIVADA');
  await page.getByRole('option', { name: 'PRIVADA', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Campos calculados y condiciones', exact: true }).click();
  await page.getByRole('combobox', { name: 'Columna o filtro', exact: true }).selectOption('AÑO');
  await page.getByRole('button', { name: 'Agregar condición de visualización' }).click();
  await page.getByRole('combobox', { name: 'Función de conteo', exact: true }).selectOption('COUNT_DISTINCT');
  await page.getByRole('button', { name: 'Agregar condición de visualización' }).click();
  await page.getByLabel('Ocultar valores cero').check();
  await page.getByRole('button', { name: 'Aplicar cálculos y condiciones' }).click();
  await save(page);
  expect(state.workspace.widgets[0].config.chart_filters).toEqual({ GESTION: { exclude: ['PRIVADA'] } });
  expect(state.workspace.widgets[0].config.display_condition.expression).toBe('(COUNT([AÑO]) <= 1) AND (COUNT_DISTINCT([AÑO]) <= 1)');
  expect(state.workspace.widgets[0].config.hide_zero).toBe(true);
});

test('browsing another sheet preserves old charts and new chart keeps individual read settings', async ({ page }) => {
  const state = await setup(page), first = structuredClone(state.workspace.widgets[0]);
  await page.getByRole('combobox', { name: 'Hoja', exact: true }).selectOption('Porcentajes');
  await page.getByRole('button', { name: 'Agregar gráfico', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Opciones del gráfico', exact: true }).last().click();
  await page.getByRole('combobox', { name: 'Fuente del gráfico', exact: true }).selectOption('file-b');
  await page.getByLabel('Encabezado del gráfico', { exact: true }).fill('4');
  await page.getByRole('combobox', { name: 'Separador decimal', exact: true }).selectOption('.');
  await page.getByRole('button', { name: 'Aplicar opciones del gráfico' }).click();
  await save(page);
  expect(state.workspace.widgets[0]).toEqual(first);
  expect(state.workspace.widgets[1]).toMatchObject({ source_id: 'file-b', library: 'ECharts', config: { sheet: 'Porcentajes', header_row: 4, decimal: '.' } });
  await page.reload();
  await expect(page.getByText('Fuente: Otra fuente.xlsx · Porcentajes', { exact: true })).toBeVisible();
});

test('table options keep selected columns, unique pairs and column formats', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('combobox', { name: 'Tipo de gráfico', exact: true }).selectOption('table');
  await page.getByRole('button', { name: 'Opciones del gráfico', exact: true }).click();
  for (const column of ['AÑO', 'NUNCA ASISTIERON', 'MATRICULA', 'PORCENTAJE']) await page.getByRole('checkbox', { name: column, exact: true }).uncheck();
  await page.getByLabel('Mostrar combinaciones únicas de las columnas visibles').check();
  await page.getByRole('combobox', { name: 'Columna para dar formato', exact: true }).selectOption('PORCENTAJE');
  await page.getByRole('combobox', { name: 'Formato común', exact: true }).selectOption('literal:0');
  await page.getByRole('button', { name: 'Aplicar opciones del gráfico' }).click();
  await save(page);
  expect(state.workspace.widgets[0].config.table_columns).toEqual(['DELEGACION', 'GESTION']);
  expect(state.workspace.widgets[0].config.table_unique).toBe(true);
  expect(state.workspace.widgets[0].config.numeric_formats.PORCENTAJE.style).toBe('literal');
});

test('editor adapts to dark mobile layout and adding metrics retains the active selector', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Agregar otra métrica', exact: true }).click();
  const metric = page.getByRole('combobox', { name: 'Métrica adicional 1', exact: true });
  await metric.focus();
  await metric.selectOption('PORCENTAJE');
  await expect(metric).toBeFocused();
  await page.screenshot({ path: 'test-results/education-editor-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/education-editor-dark-mobile.png', fullPage: true });
});

test('copying fields retains their dependency chain and cancel discards the copy', async ({ page }) => {
  const state = await setup(page);
  const definitions = [{ name: 'Base', expression: 'SUM([MATRICULA])', mode: 'aggregate' }, { name: 'Doble', expression: '[Base] * 2', mode: 'aggregate' }];
  state.workspace.widgets[0].config.calculated_fields = definitions;
  await page.reload();
  await page.getByRole('button', { name: 'Agregar gráfico', exact: true }).click();
  await page.getByRole('button', { name: 'Campos calculados y condiciones', exact: true }).last().click();
  await page.getByRole('combobox', { name: 'Copiar desde otro gráfico', exact: true }).selectOption({ label: 'Matrícula' });
  await expect(page.getByRole('combobox', { name: 'Campo calculado', exact: true }).locator('option')).toHaveCount(3);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Campos calculados y condiciones', exact: true }).last().click();
  await expect(page.getByRole('combobox', { name: 'Campo calculado', exact: true }).locator('option')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Copiar desde otro gráfico', exact: true }).selectOption({ label: 'Matrícula' });
  await page.getByRole('button', { name: 'Aplicar cálculos y condiciones' }).click();
  await save(page);
  expect(state.workspace.widgets[1].config.calculated_fields).toEqual(definitions);
});

test('percentage scale and literal percentage present different numeric inputs consistently', async ({ page }) => {
  const state = await setup(page);
  const format = { style: 'percent', decimals: 2, grouping: true, prefix: '', suffix: '', empty: '-' };
  Object.assign(state.workspace.widgets[0].config, { chart_type: 'indicator', indicator_suffix: '%', numeric_formats: { MATRICULA: format } });
  let value = .42;
  await page.route('**/v2/sources/file-a/chart', route => route.fulfill({ json: { labels: ['Total'], datasets: [{ label: 'MATRICULA', data: [value] }], filtered_rows: 1, warnings: [] } }));
  await page.reload();
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('42,00 %');
  await page.getByRole('button', { name: 'Opciones del gráfico', exact: true }).click();
  await page.getByRole('combobox', { name: 'Formato común', exact: true }).selectOption('literal:0');
  await page.getByRole('button', { name: 'Aplicar opciones del gráfico' }).click();
  value = 42;
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('42 %');
  await page.getByRole('button', { name: 'Opciones del gráfico', exact: true }).click();
  await page.getByRole('combobox', { name: 'Formato común', exact: true }).selectOption('number:2');
  await page.getByRole('combobox', { name: 'Separador de decimales', exact: true }).selectOption('.');
  await page.getByRole('combobox', { name: 'Separador de miles', exact: true }).selectOption(',');
  await page.getByLabel('Prefijo', { exact: true }).fill('$ ');
  await page.getByLabel('Sufijo', { exact: true }).fill(' unidades');
  await page.getByRole('button', { name: 'Aplicar opciones del gráfico' }).click();
  value = 1234.5;
  await page.getByRole('button', { name: 'Generar gráfico', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText('$ 1,234.50 unidades');
  await save(page);
  expect(state.workspace.widgets[0].config.indicator_suffix).toBe('%');
});
