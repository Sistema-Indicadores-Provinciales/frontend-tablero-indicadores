import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixtures: { key: string; name: string; widgets: { id: string; title: string; type: string }[] }[] = JSON.parse(readFileSync(new URL('./fixtures/illustrated-health.json', import.meta.url), 'utf8'));

type Fixture = typeof fixtures[number];
async function setup(page: Page, fixture: Fixture) {
  const widgets = fixture.widgets.map(widget => ({ id: widget.id, title: widget.title, width: 6, library: 'ECharts', config: {
    sheet: 'Datos', header_row: 1, decimal: ',', types: {}, chart_type: widget.type,
    aggregation: 'sum', x_col: 'Mes', y_col: 'Valor', group_col: '', date_bucket: 'none', filters: {},
  } }));
  const state = { widgets, requests: [] as any[], denied: false };
  const board = { _id: 'board', keyname: 'salud', name: 'Salud', show: true, sections: [{ _id: 'section', keyname: 'informe', name: fixture.name, show: true, workspaceId: 'saved' }] };
  await page.addInitScript(() => localStorage.setItem('user', JSON.stringify({ _id: 'reader', username: 'Revisión', profileType: 'INVITADO', access_token: 'test' })));
  await page.route(/:(3000|8000)\//, async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const workspace = { _id: 'saved', name: fixture.name, source_id: 'source', widgets: state.widgets, filter_columns: ['Mes'], source_kind: 'upload', can_edit: false };
    let data: any = { data: [] }, status = 200;
    if (path === '/dashboard/get-all') data = { data: [board] };
    else if (path === '/user/my-dashboards') data = { data: [{ ...board, sections: ['informe'] }] };
    else if (path === '/v2/workspaces/saved/view') data = workspace;
    else if (path === '/v2/workspaces/saved/render') {
      const body = request.postDataJSON(); state.requests.push(body);
      const filtered = !!body.filters.Mes?.length;
      if (state.denied) { status = 403; data = { detail: 'No tenés acceso a esta sección.' }; }
      else data = { snapshot_id: 'snapshot', workspace, filter_options: { Mes: { values: ['Enero', 'Febrero'], total: 2, type: 'text' } },
        widgets: Object.fromEntries(state.widgets.map((widget, index) => [widget.id, { data: {
          labels: ['Enero', 'Febrero'], datasets: [{ label: 'Valor', data: [(index + 1) * (filtered ? 10 : 100), 20] }],
          filtered_rows: widget.config.chart_type === 'map' ? 0 : filtered ? 1 : 2, warnings: [],
          columns: ['Mes', 'Valor'], records: [{ Mes: 'Enero', Valor: (index + 1) * (filtered ? 10 : 100) }],
        } }])) };
    }
    await route.fulfill({ status, json: data });
  });
  return state;
}

for (const fixture of fixtures) {
  test(`${fixture.key}: original images, complete widgets and live filters in both themes`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const state = await setup(page, fixture);
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/salud/informe');
    const section = page.locator(`[data-section-design="${fixture.key}"]`);
    await expect(section).toBeVisible();
    await expect(section.locator('.generator-widget')).toHaveCount(fixture.widgets.length);
    for (const [index, widget] of fixture.widgets.entries()) {
      const card = page.getByRole('region', { name: widget.title, exact: true });
      await expect(card).toHaveCount(1);
      if (widget.type === 'indicator') await expect(card.locator('.generator-indicator strong')).toHaveText(((index + 1) * 100).toLocaleString('es-AR'));
    }
    const expectedImages = { 'covid-diario': 3, 'dengue-diario': 8, 'vacunacion-covid': 4, 'vacunacion-dengue': 3 };
    await expect(section.locator('img')).toHaveCount(expectedImages[fixture.key as keyof typeof expectedImages]);
    await expect.poll(() => section.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.getByRole('button', { name: 'Filtrar por Mes', exact: true }).click();
    await page.getByRole('button', { name: 'Solamente Enero', exact: true }).click();
    for (const [index, widget] of fixture.widgets.entries()) {
      if (widget.type === 'indicator') await expect(page.getByRole('region', { name: widget.title, exact: true }).locator('.generator-indicator strong')).toHaveText(String((index + 1) * 10));
    }
    expect(state.requests.at(-1).filters).toEqual({ Mes: ['Enero'] });
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
      await page.screenshot({ path: `test-results/${fixture.key}-${theme}.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const filter = await page.getByRole('region', { name: 'Filtros de la sección', exact: true }).boundingBox();
      expect(filter!.y).toBeGreaterThanOrEqual(55);
      expect(filter!.y).toBeLessThan(90);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `test-results/${fixture.key}-${theme}-mobile.png`, fullPage: true });
      await page.setViewportSize({ width: 1440, height: 950 });
    }
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect.poll(() => state.requests.at(-1).filters).toEqual({});
    expect(errors).toEqual([]);
  });
}

test('renamed, removed and newly added charts remain usable without changing saved configuration', async ({ page }) => {
  const state = await setup(page, fixtures[0]);
  state.widgets[0].title = 'Indicador renombrado';
  state.widgets = state.widgets.filter(widget => !['covid-altas', 'covid-recuperados', 'covid-fallecimientos'].includes(widget.id));
  state.widgets.push({ ...state.widgets[0], id: 'new-widget', title: 'Nuevo indicador' });
  const before = JSON.stringify(state.widgets);
  await page.goto('/salud/informe');
  await expect(page.getByRole('region', { name: 'Indicador renombrado', exact: true }).locator('strong')).toHaveText('100');
  await expect(page.getByRole('region', { name: 'Nuevo indicador', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Evolución de los pacientes', exact: true })).toHaveCount(0);
  await expect(page.locator('.generator-widget')).toHaveCount(state.widgets.length);
  expect(JSON.stringify(state.widgets)).toBe(before);
  state.denied = true;
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  await expect(page.locator('.generator-widget')).toHaveCount(0);
  await expect(page.locator('.section-illustration')).toHaveCount(0);
});
