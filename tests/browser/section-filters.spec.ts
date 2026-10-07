import { test, expect, Page } from '@playwright/test';

const config = { sheet: 'Datos', header_row: 1, decimal: ',', types: {}, chart_type: 'indicator', aggregation: 'sum', x_col: 'Total', y_col: 'Total', group_col: '', date_bucket: 'none', filters: {} };
const counters = ['Total intervenciones', 'Por mes', 'Por tipo', 'Otra hoja'].map((title, index) => ({ id: String(index), title, width: 6, library: 'Plotly',
  config: { ...config, x_col: ['Total', 'Mes', 'Año', 'Tipo'][index] } }));
const widgets = [
  { id: '4', title: 'Evolución mensual', width: 12, library: 'ECharts', config: { ...config, chart_type: 'bar', x_col: 'Mes' } },
  ...counters,
];
const columns = ['Año', 'Mes', 'Tipo', 'Total'];
const options = { Año: { values: ['2025', '2026'], total: 2, type: 'number' }, Mes: { values: ['Marzo', 'Enero', 'Febrero'], total: 3, type: 'text' }, Tipo: { values: ['Grupal', 'Individual'], total: 2, type: 'text' }, Total: { values: ['1', '10', '30'], total: 3, type: 'number' } };

async function only(page: Page, column: string, value: string) {
  await page.getByRole('button', { name: `Filtrar por ${column}`, exact: true }).click();
  await page.getByRole('dialog', { name: `Filtrar por ${column}`, exact: true }).getByRole('button', { name: `Solamente ${value}`, exact: true }).click();
}

async function setup(page: Page, legacy = false, contextual = false) {
  const state = { denied: false, requests: [] as { id: string; filters: Record<string, string[]> }[], saves: [] as any[],
    rows: [
      { Año: '2026', Mes: 'Enero', Tipo: 'Individual', Total: 10 },
      { Año: '2026', Mes: 'Febrero', Tipo: 'Grupal', Total: 20 },
      { Año: '2026', Mes: 'Febrero', Tipo: 'Individual', Total: 5 },
      { Año: '2025', Mes: 'Marzo', Tipo: 'Grupal', Total: 30 },
    ] as Record<string, string | number>[],
    workspace: { _id: 'saved', name: 'Intervenciones', source_id: 'file', widgets, ...(legacy ? {} : { filter_columns: contextual ? ['Año', 'Mes', 'Tipo'] : ['Año', 'Mes'] }) } };
  const board = { _id: 'board', keyname: 'educacion', name: 'Educación', show: true, sections: [{ _id: 'section', keyname: 'intervenciones', name: 'Intervenciones', show: true, workspaceId: 'saved' }] };
  await page.addInitScript(() => localStorage.setItem('user', JSON.stringify({ _id: 'owner', username: 'Ana', profileType: 'ADMIN', access_token: 'test' })));
  await page.route(/:(3000|8000)\//, async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    let data: any = { data: [] }, status = 200;
    if (path === '/dashboard/get-all') data = { data: [board] };
    else if (path === '/user/my-dashboards') data = { data: [{ ...board, sections: ['intervenciones'] }] };
    else if (path === '/v2/google/status') data = { public_access: true, client_id: '' };
    else if (path === '/v2/workspaces/restore-menu') data = { restored: 0 };
    else if (path === '/v2/workspaces') data = [state.workspace];
    else if (path === '/v2/workspaces/saved') {
      if (req.method() === 'PUT') { state.saves.push(req.postDataJSON()); state.workspace = { _id: 'saved', ...req.postDataJSON() }; }
      data = state.workspace;
    }
    else if (path === '/v2/workspaces/saved/view') data = { ...state.workspace, can_edit: true, source_kind: 'upload' };
    else if (path.endsWith('/publication')) data = { canShare: false, canView: true, currentUserId: 'owner', users: [], recipientIds: [], show: true, path: '/educacion/intervenciones' };
    else if (path === '/v2/sources') data = [{ _id: 'file', name: 'Intervenciones.xlsx', kind: 'upload' }];
    else if (path.endsWith('/sheets')) data = ['Datos'];
    else if (path.endsWith('/preview')) data = { columns, column_meta: Object.fromEntries(columns.map(c => [c, { type: options[c as keyof typeof options].type, unique_values: options[c as keyof typeof options].values, unique_count: options[c as keyof typeof options].total }])), row_count: 3, preview: [], raw_preview: [], warnings: [] };
    else if (path === '/v2/workspaces/saved/render') {
      const filters = req.postDataJSON().filters || {};
      if (state.denied) { status = 404; data = { detail: 'No tenés acceso a esta sección.' }; }
      else {
        const render = (id: string) => {
          state.requests.push({ id, filters });
          if (contextual) {
            const matches = (row: Record<string, string | number>, except?: string) => Object.entries(filters as Record<string, string[]>).every(([column, values]) => column === except || !values.length || values.includes(String(row[column])));
            const rows = state.rows.filter(row => matches(row));
            return { data: { labels: ['Total'], datasets: [{ label: 'Total', data: [id === '3' ? 7 : rows.reduce((sum, row) => sum + Number(row.Total), 0)] }], filtered_rows: id === '3' ? 1 : rows.length, warnings: [],
              filter_options: id === '3' ? { Tipo: { values: ['Grupal'], total: 1 } } : Object.fromEntries((state.workspace.filter_columns || []).map(column => {
                const values = [...new Set(state.rows.filter(row => matches(row, column)).map(row => String(row[column])))];
                return [column, { values: values.slice(0, 100), total: values.length, type: options[column as keyof typeof options].type,
                  unfiltered_total: new Set(state.rows.map(row => row[column])).size, available_selected: (filters[column] || []).filter((value: string) => values.includes(value)) }];
              })), ignored_filters: id === '3' ? Object.keys(filters).filter(column => column !== 'Tipo') : [] } };
          }
          return { data: { labels: ['Total'], datasets: [{ label: 'Total', data: [id === '3' ? 7 : filters.Mes?.length ? 10 : filters.Año?.length ? 30 : 100] }], filtered_rows: 3, warnings: [],
            filter_options: Object.fromEntries(Object.entries(options).filter(([key]) => id !== '3' && (state.workspace.filter_columns?.includes(key) ?? true))),
            ignored_filters: id === '3' ? Object.keys(filters) : [] } };
        };
        const rendered = Object.fromEntries(state.workspace.widgets.map(widget => [widget.id, render(widget.id)]));
        data = { snapshot_id: 'snapshot', workspace: { ...state.workspace, can_edit: true, source_kind: 'upload' }, widgets: rendered,
          filter_options: rendered['0'].data.filter_options };
      }
    }
    await route.fulfill({ status, json: data });
  });
  return state;
}

test('one compact bar filters all compatible charts immediately and stays below the header on scroll', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/educacion/intervenciones');
  const bar = page.getByRole('region', { name: 'Filtros de la sección', exact: true });
  await expect(page.locator('.generator-indicator strong')).toHaveText(['100', '100', '100', '7'], { timeout: 60000 });
  const counters = page.getByRole('region', { name: 'Contadores de la sección' });
  const graph = page.getByRole('region', { name: 'Evolución mensual' });
  await expect(graph.locator('canvas')).toBeVisible({ timeout: 60000 });
  await expect(counters.getByRole('heading')).toHaveText(['Total intervenciones', 'Por mes', 'Por tipo', 'Otra hoja']);
  await expect(counters.getByText('Total intervenciones', { exact: true })).toHaveCount(1);
  const counterBounds = (await counters.boundingBox())!, filterBounds = (await bar.boundingBox())!;
  expect(counterBounds.y).toBeGreaterThanOrEqual(filterBounds.y + filterBounds.height);
  expect(counterBounds.height).toBeLessThan(180);
  expect((await graph.boundingBox())!.y).toBeGreaterThanOrEqual(counterBounds.y + counterBounds.height);
  await page.screenshot({ path: 'test-results/compact-counters-desktop.png', fullPage: true });
  await expect(bar).toHaveCount(1);
  await expect(page.getByText('Filtrar este gráfico', { exact: true })).toHaveCount(0);
  await expect(bar.getByRole('button', { name: 'Filtrar por Total', exact: true })).toHaveCount(0);
  await only(page, 'Año', '2026');
  await expect(page.locator('.generator-indicator strong')).toHaveText(['30', '30', '30', '7']);
  await bar.getByRole('button', { name: 'Filtrar por Mes', exact: true }).click();
  const months = page.getByRole('dialog', { name: 'Filtrar por Mes' });
  await expect(months.getByRole('listitem').getByRole('paragraph')).toHaveText(['Enero', 'Febrero', 'Marzo']);
  await months.getByRole('button', { name: 'Solamente Enero', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText(['10', '10', '10', '7']);
  for (const id of ['0', '1', '2', '3']) expect(state.requests.filter(r => r.id === id).at(-1)?.filters).toEqual({ Año: ['2026'], Mes: ['Enero'] });
  await expect(page.getByText('Este gráfico no tiene los campos:', { exact: false })).toContainText('Año, Mes');
  await page.evaluate(() => window.scrollTo(0, 650));
  await expect.poll(async () => (await bar.boundingBox())?.y).toBeGreaterThanOrEqual(64);
  await expect.poll(async () => (await bar.boundingBox())?.y).toBeLessThan(70);
  await expect.poll(async () => (await bar.boundingBox())?.height).toBeLessThan(110);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect.poll(async () => (await bar.boundingBox())?.x).toBeGreaterThan(280);
  await expect.poll(async () => (await bar.boundingBox())?.y).toBeLessThan(70);
  await page.screenshot({ path: 'test-results/section-filters-desktop.png' });
  await page.locator('.MuiDrawer-paper').getByRole('button').first().click();
  await bar.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText(['100', '100', '100', '7']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const first = (await counters.locator('.generator-counter').nth(0).boundingBox())!;
  const second = (await counters.locator('.generator-counter').nth(1).boundingBox())!;
  expect(first.height).toBeLessThan(180);
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
  await page.screenshot({ path: 'test-results/compact-counters-mobile.png', fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect.poll(async () => (await bar.boundingBox())?.y).toBeGreaterThanOrEqual(56);
  await expect.poll(async () => (await bar.boundingBox())?.y).toBeLessThan(62);
  await expect.poll(async () => (await bar.boundingBox())?.height).toBeLessThan(145);
  await page.screenshot({ path: 'test-results/section-filters-mobile.png' });
  expect(state.saves).toEqual([]);
});

test('cascading choices hide Grupal in January, retain multi-select alternatives and restore on clear', async ({ page }) => {
  const state = await setup(page, false, true);
  await page.goto('/educacion/intervenciones');
  await only(page, 'Año', '2026');
  await only(page, 'Mes', 'Enero');
  await expect(page.locator('.generator-indicator strong')).toHaveText(['10', '10', '10', '7']);
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  await page.getByRole('button', { name: 'Filtrar por Tipo', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Filtrar por Tipo', exact: true });
  // The other sheet (chart 3) has Grupal but cannot filter by Mes; it must not
  // reintroduce this option when compatible charts have no January group rows.
  await expect(popup.getByRole('checkbox', { name: 'Individual', exact: true })).toBeVisible();
  await expect(popup.getByRole('checkbox', { name: 'Grupal', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/cascading-january-dark.png', fullPage: true });
  const search = popup.getByRole('textbox', { name: 'Buscar en Tipo' });
  await search.fill('Grupal');
  await search.press('Enter');
  await expect(popup.getByText('Sin coincidencias')).toBeVisible();
  await expect(popup.getByRole('button', { name: /Usar/ })).toHaveCount(0);
  expect(state.requests.at(-1)?.filters.Tipo).toBeUndefined();
  await search.press('Escape');
  await page.getByRole('button', { name: 'Filtrar por Mes', exact: true }).click();
  const months = page.getByRole('dialog', { name: 'Filtrar por Mes', exact: true });
  await months.getByRole('checkbox', { name: 'Febrero', exact: true }).check();
  await months.getByRole('textbox').press('Escape');
  await expect(page.locator('.generator-indicator strong')).toHaveText(['35', '35', '35', '7']);
  await page.getByRole('button', { name: 'Filtrar por Tipo', exact: true }).click();
  await expect(popup.getByRole('checkbox', { name: 'Grupal', exact: true })).toBeVisible();
  await popup.getByRole('button', { name: 'Solamente Individual', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText(['15', '15', '15', '7']);
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText(['65', '65', '65', '7']);
  await only(page, 'Tipo', 'Grupal');
  await expect(page.locator('.generator-indicator strong')).toHaveText(['50', '50', '50', '7']);
  expect(state.saves).toEqual([]);
});

test('selected values removed from the source stay removable and are never silently cleared', async ({ page }) => {
  const state = await setup(page, false, true);
  await page.goto('/educacion/intervenciones');
  await only(page, 'Mes', 'Febrero');
  await only(page, 'Tipo', 'Grupal');
  await expect(page.locator('.generator-indicator strong')).toHaveText(['20', '20', '20', '7']);
  state.rows = state.rows.filter(row => row.Tipo !== 'Grupal');
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  await expect(page.getByText('No hay datos para los filtros seleccionados.')).toHaveCount(4);
  await page.getByRole('button', { name: 'Filtrar por Tipo', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Filtrar por Tipo' });
  await expect(popup.getByText('Sin datos con los otros filtros')).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Solamente Grupal' })).toHaveCount(0);
  await popup.getByRole('button', { name: 'Quitar Grupal' }).click();
  await expect(popup.getByText('Grupal', { exact: true })).toHaveCount(0);
  await popup.getByRole('textbox').press('Escape');
  await expect(page.locator('.generator-indicator strong')).toHaveText(['5', '5', '5', '7']);
  expect(state.requests.filter(req => req.id === '0').at(-1)?.filters).toEqual({ Mes: ['Febrero'] });
  expect(state.saves).toEqual([]);
});

test('cascading options wait for current chart responses and never mix with stale choices', async ({ page }) => {
  await setup(page, false, true);
  let started = false, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/v2/workspaces/saved/render', async route => {
    if (!route.request().postDataJSON().filters.Mes?.includes('Enero')) return route.fallback();
    started = true;
    await pending;
    await route.fallback();
  });
  await page.goto('/educacion/intervenciones');
  await only(page, 'Mes', 'Enero');
  await expect.poll(() => started).toBe(true);
  const type = page.getByRole('button', { name: 'Filtrar por Tipo', exact: true });
  await expect(type).toBeEnabled();
  await type.click();
  const pendingType = page.getByRole('dialog', { name: 'Filtrar por Tipo' });
  await expect(pendingType.getByRole('status')).toHaveText('Actualizando opciones…');
  await expect(pendingType.getByRole('checkbox', { name: 'Individual', exact: true })).toBeDisabled();
  await pendingType.getByRole('textbox').press('Escape');
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await only(page, 'Mes', 'Febrero');
  release();
  await expect(page.locator('.generator-indicator strong')).toHaveText(['25', '25', '25', '7']);
  await page.getByRole('button', { name: 'Filtrar por Tipo', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Filtrar por Tipo' });
  await expect(popup.getByRole('listitem').getByRole('paragraph')).toHaveText(['Grupal', 'Individual']);
});

test('values beyond the suggestion limit remain valid selections after server validation', async ({ page }) => {
  const state = await setup(page, false, true);
  state.rows = Array.from({ length: 120 }, (_, index) => ({ Año: '2026', Mes: 'Enero', Tipo: `Tipo ${index}`, Total: 1 }));
  await page.goto('/educacion/intervenciones');
  await only(page, 'Mes', 'Enero');
  await page.getByRole('button', { name: 'Filtrar por Tipo', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Filtrar por Tipo' });
  await popup.getByRole('textbox').fill('Tipo 119');
  await popup.getByRole('textbox').press('Enter');
  await expect(popup.getByRole('checkbox', { name: 'Tipo 119', exact: true })).toBeChecked();
  await expect(popup.getByRole('button', { name: 'Solamente Tipo 119', exact: true })).toBeEnabled();
  await expect(popup.getByText('Sin datos con los otros filtros')).toHaveCount(0);
  await popup.getByRole('textbox').press('Escape');
  await expect(page.locator('.generator-indicator strong')).toHaveText(['1', '1', '1', '7']);
  expect(state.saves).toEqual([]);
});

test('author chooses the visible fields in the generator and changes persist on reload', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/generador?editar=saved');
  const picker = page.getByRole('combobox', { name: 'Campos para filtrar la sección' });
  await expect(picker).toBeVisible({ timeout: 60000 });
  await picker.fill('Tipo');
  await page.getByRole('listbox').getByRole('option', { name: 'Tipo', exact: true }).click();
  await picker.press('Escape');
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await expect(page.getByText('Tablero guardado. Ya aparece', { exact: false })).toBeVisible();
  expect(state.saves[0].filter_columns).toEqual(['Año', 'Mes', 'Tipo']);
  await page.goto('/educacion/intervenciones');
  await expect(page.getByRole('region', { name: 'Filtros de la sección' }).getByRole('button', { name: /^Filtrar por / })).toHaveCount(3);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Filtros de la sección' }).getByRole('button', { name: /^Filtrar por / })).toHaveCount(3);
  await page.getByRole('link', { name: 'Editar gráficos y accesos' }).click();
  await page.getByRole('button', { name: 'Quitar todos', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar tablero', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y aplicar accesos' }).click();
  await expect.poll(() => state.workspace.filter_columns).toEqual([]);
  await page.goto('/educacion/intervenciones');
  await expect(page.locator('.generator-indicator strong')).toHaveCount(4);
  await expect(page.getByRole('region', { name: 'Filtros de la sección' })).toHaveCount(0);
});

test('older sections suggest year and month rather than Total, and refresh preserves selections', async ({ page }) => {
  await setup(page, true);
  await page.goto('/educacion/intervenciones');
  const bar = page.getByRole('region', { name: 'Filtros de la sección' });
  await expect(bar.getByRole('button', { name: 'Filtrar por Año', exact: true })).toBeEnabled({ timeout: 60000 });
  await expect(bar.getByRole('button', { name: 'Filtrar por Total', exact: true })).toHaveCount(0);
  await only(page, 'Año', '2026');
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  await expect(page.locator('.generator-indicator strong')).toHaveText(['30', '30', '30', '7']);
});

test('revoked access removes chart results and filter values on the next selection', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/educacion/intervenciones');
  const bar = page.getByRole('region', { name: 'Filtros de la sección' });
  await expect(bar.getByRole('button', { name: 'Filtrar por Año', exact: true })).toBeEnabled({ timeout: 60000 });
  state.denied = true;
  await only(page, 'Año', '2026');
  await expect(page.getByRole('alert')).toContainText('No tenés acceso');
  await expect(bar).toHaveCount(0);
  await expect(page.locator('.generator-indicator')).toHaveCount(0);
});

test('rapid filter changes discard a slow previous response', async ({ page }) => {
  const state = await setup(page);
  let started = false, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/v2/workspaces/saved/render', async route => {
    if (!route.request().postDataJSON().filters.Año?.includes('2025')) return route.fallback();
    started = true;
    await pending;
    await route.fallback();
  });
  await page.goto('/educacion/intervenciones');
  const bar = page.getByRole('region', { name: 'Filtros de la sección' });
  const year = bar.getByRole('button', { name: 'Filtrar por Año', exact: true });
  await expect(year).toBeEnabled({ timeout: 60000 });
  await only(page, 'Año', '2025');
  await expect.poll(() => started).toBe(true);
  await bar.getByRole('button', { name: 'Limpiar filtros' }).click();
  await only(page, 'Año', '2026');
  release();
  await expect(page.locator('.generator-indicator strong')).toHaveText(['30', '30', '30', '7']);
  expect(state.requests.filter(r => r.id === '0').map(request => request.filters)).toContainEqual({ Año: ['2026'] });
});

test('search, multiple selections and Solamente work in dark mode and the popup fits a phone', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/educacion/intervenciones');
  await expect(page.locator('.generator-indicator strong')).toHaveCount(4, { timeout: 60000 });
  const bar = page.getByRole('region', { name: 'Filtros de la sección' });
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('region', { name: 'Evolución mensual' }).locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/compact-counters-dark.png', fullPage: true });
  await bar.getByRole('button', { name: 'Filtrar por Mes' }).click();
  const popup = page.getByRole('dialog', { name: 'Filtrar por Mes' });
  await popup.getByRole('checkbox', { name: 'Todos', exact: true }).uncheck();
  await popup.getByRole('checkbox', { name: 'Enero', exact: true }).check();
  await popup.getByRole('checkbox', { name: 'Febrero', exact: true }).check();
  await expect(popup.getByText('2 seleccionados', { exact: true })).toBeVisible();
  await expect.poll(() => state.requests.filter(r => r.id === '0').at(-1)?.filters.Mes).toEqual(['Enero', 'Febrero']);
  await popup.getByRole('textbox', { name: 'Buscar en Mes' }).fill('féb');
  await expect(popup.getByRole('checkbox', { name: 'Febrero', exact: true })).toBeVisible();
  await expect(popup.getByRole('checkbox', { name: 'Enero', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/section-filters-dark-popup.png' });
  await popup.getByRole('button', { name: 'Solamente Febrero', exact: true }).click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await expect.poll(() => state.requests.filter(r => r.id === '0').at(-1)?.filters.Mes).toEqual(['Febrero']);
  await page.evaluate(() => window.scrollTo(0, 650));
  await expect.poll(async () => (await bar.boundingBox())?.y).toBeLessThan(70);
  await page.screenshot({ path: 'test-results/section-filters-dark-sticky.png' });
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('.generator-indicator strong')).toHaveText(['100', '100', '100', '7']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 700));
  await bar.getByRole('button', { name: 'Filtrar por Mes' }).click();
  await popup.getByRole('checkbox', { name: 'Todos', exact: true }).uncheck();
  await popup.getByRole('checkbox', { name: 'Enero', exact: true }).check();
  await popup.getByRole('checkbox', { name: 'Todos', exact: true }).check();
  await expect.poll(() => state.requests.filter(r => r.id === '0').at(-1)?.filters).toEqual({});
  const bounds = (await popup.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: 'test-results/section-filters-dark-mobile.png' });
  await page.evaluate(() => window.scrollBy(0, 100));
  await expect(popup).toBeVisible();
  await popup.getByRole('textbox', { name: 'Buscar en Mes' }).press('Escape');
  await expect(popup).toHaveCount(0);
});
