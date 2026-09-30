import { test, expect, Page } from '@playwright/test';

const config = { sheet: 'Datos', header_row: 1, decimal: ',', types: {}, chart_type: 'indicator', aggregation: 'sum', x_col: 'Total', y_col: 'Total', group_col: '', date_bucket: 'none', filters: {} };
const widgets = ['Total intervenciones', 'Por mes', 'Por tipo', 'Otra hoja'].map((title, index) => ({ id: String(index), title, width: 6, library: 'Plotly',
  config: { ...config, x_col: ['Total', 'Mes', 'Año', 'Tipo'][index] } }));
const columns = ['Año', 'Mes', 'Tipo', 'Total'];
const options = { Año: { values: ['2025', '2026'], total: 2, type: 'number' }, Mes: { values: ['Marzo', 'Enero', 'Febrero'], total: 3, type: 'text' }, Tipo: { values: ['Grupal', 'Individual'], total: 2, type: 'text' }, Total: { values: ['1', '10', '30'], total: 3, type: 'number' } };

async function only(page: Page, column: string, value: string) {
  await page.getByRole('button', { name: `Filtrar por ${column}`, exact: true }).click();
  await page.getByRole('dialog', { name: `Filtrar por ${column}`, exact: true }).getByRole('button', { name: `Solamente ${value}`, exact: true }).click();
}

async function setup(page: Page, legacy = false) {
  const state = { denied: false, requests: [] as { id: string; filters: Record<string, string[]> }[], saves: [] as any[],
    workspace: { _id: 'saved', name: 'Intervenciones', source_id: 'file', widgets, ...(legacy ? {} : { filter_columns: ['Año', 'Mes'] }) } };
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
    else if (/\/widgets\/\d\/chart$/.test(path)) {
      const id = path.split('/').at(-2)!;
      const filters = req.method() === 'POST' ? req.postDataJSON().filters : {};
      state.requests.push({ id, filters });
      if (state.denied) { status = 404; data = { detail: 'No tenés acceso a esta sección.' }; }
      else data = { labels: ['Total'], datasets: [{ label: 'Total', data: [id === '3' ? 7 : filters.Mes?.length ? 10 : filters.Año?.length ? 30 : 100] }], filtered_rows: 3, warnings: [],
        filter_options: Object.fromEntries(Object.entries(options).filter(([key]) => id !== '3' && (state.workspace.filter_columns?.includes(key) ?? true))),
        ignored_filters: id === '3' ? Object.keys(filters) : [] };
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
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect.poll(async () => (await bar.boundingBox())?.y).toBeGreaterThanOrEqual(56);
  await expect.poll(async () => (await bar.boundingBox())?.y).toBeLessThan(62);
  await expect.poll(async () => (await bar.boundingBox())?.height).toBeLessThan(145);
  await page.screenshot({ path: 'test-results/section-filters-mobile.png' });
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
  await page.route('**/v2/workspaces/saved/widgets/0/chart', async route => {
    if (route.request().method() !== 'POST' || !route.request().postDataJSON().filters.Año?.includes('2025')) return route.fallback();
    started = true;
    await pending;
    await route.fulfill({ json: { labels: ['Total'], datasets: [{ label: 'Total', data: [9999] }], filtered_rows: 1, warnings: [], filter_options: options } });
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
  expect(state.requests.filter(r => r.id === '0').at(-1)?.filters).toEqual({ Año: ['2026'] });
});

test('search, multiple selections and Solamente work in dark mode and the popup fits a phone', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/educacion/intervenciones');
  await expect(page.locator('.generator-indicator strong')).toHaveCount(4, { timeout: 60000 });
  const bar = page.getByRole('region', { name: 'Filtros de la sección' });
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await bar.getByRole('button', { name: 'Filtrar por Mes' }).click();
  const popup = page.getByRole('dialog', { name: 'Filtrar por Mes' });
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
