import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { isAxiosError } from 'axios';
import { analytics, errorMessage } from 'config/Analytics';
import GoogleConnectionPanel from 'components/analytics/GoogleConnectionPanel';
import NavbarContext from 'contexts/NavbarContext';
import { FilterOptions, SectionFilters, SectionRenderResponse, SectionWidgetRender, Widget, WorkspaceView } from 'types/Generator';
import SavedChart from 'components/analytics/SavedChart';
import SectionFilterBar from 'components/analytics/SectionFilterBar';
import { suggestFilterColumns } from 'utils/sectionFilters';
import './chart-generator.css';

type Props = { workspaceId: string; title: string; dashboardName?: string; dashboardPath?: string };
type RequestFilters = Record<string, string[] | { exclude: string[] }>;

export default function SavedDashboard(props: Props) { return <SectionDashboard key={props.workspaceId} {...props} />; }

function requestFilters(filters: SectionFilters): RequestFilters {
  return Object.fromEntries(Object.entries(filters).map(([column, selection]) => [
    column,
    selection.mode === 'exclude' ? { exclude: selection.values } : selection.values,
  ]));
}

function catalogFrom(options: FilterOptions): FilterOptions {
  return Object.fromEntries(Object.entries(options).map(([column, option]) => [column, {
    values: [], type: option.type, total: option.unfiltered_total ?? option.total,
  }]));
}

function SectionDashboard({ workspaceId, title, dashboardName, dashboardPath }: Props) {
  const { changeNavTitle } = useContext(NavbarContext);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [results, setResults] = useState<Record<string, SectionWidgetRender>>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [catalog, setCatalog] = useState<FilterOptions>({});
  const [filters, setFilters] = useState<SectionFilters>({});
  const [error, setError] = useState('');
  const [snapshotExpired, setSnapshotExpired] = useState(false);
  const [viewLoading, setViewLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [googleToken, setGoogleToken] = useState('');
  const [connectionVersion, setConnectionVersion] = useState(0);
  const snapshotId = useRef('');
  const request = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);

  const legacyColumns = useMemo(() => new Set(workspace?.widgets.flatMap(({ config }) => [
    config.x_col, config.y_col, config.group_col, ...Object.keys(config.filters || {}),
  ])), [workspace]);
  const legacyOptions = useMemo(() => Object.fromEntries(
    Object.entries(catalog).filter(([column]) => legacyColumns.has(column)),
  ), [catalog, legacyColumns]);
  const columns = workspace?.filter_columns ?? [...new Set([
    ...suggestFilterColumns(legacyOptions),
    ...Object.keys(filters).filter(column => filters[column].values.length),
  ])];
  const filterSignature = JSON.stringify(Object.fromEntries(Object.entries(filters).filter(([column, selection]) =>
    columns.includes(column) && selection.values.length,
  )));
  const activeFilters = useMemo<SectionFilters>(() => JSON.parse(filterSignature), [filterSignature]);

  const renderSection = useCallback(async (selectedFilters: SectionFilters, refresh = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const version = ++requestVersion.current;
    setRendering(true); setRefreshing(refresh); setError(''); setSnapshotExpired(false);
    try {
      const body: { filters: RequestFilters; refresh?: boolean; snapshot_id?: string } = {
        filters: requestFilters(selectedFilters),
      };
      if (refresh) body.refresh = true;
      if (snapshotId.current) body.snapshot_id = snapshotId.current;
      const { data } = await analytics.post<SectionRenderResponse>(`/v2/workspaces/${encodeURIComponent(workspaceId)}/render`, body, {
        signal: controller.signal,
        headers: googleToken ? { 'X-Google-Access-Token': googleToken } : {},
      });
      if (controller.signal.aborted || version !== requestVersion.current) return;
      snapshotId.current = data.snapshot_id;
      setWorkspace(data.workspace);
      setResults(data.widgets);
      setFilterOptions(data.filter_options || {});
      setCatalog(previous => ({ ...previous, ...catalogFrom(data.filter_options || {}) }));
    } catch (cause) {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      const status = isAxiosError(cause) ? cause.response?.status : undefined;
      if ([401, 403, 404].includes(status || 0)) {
        snapshotId.current = '';
        setWorkspace(null); setResults({}); setFilterOptions({}); setCatalog({}); setFilters({});
      }
      setSnapshotExpired(status === 409 && !!snapshotId.current && !refresh);
      setError(errorMessage(cause));
    } finally {
      if (!controller.signal.aborted && version === requestVersion.current) {
        setRendering(false); setRefreshing(false);
      }
    }
  }, [googleToken, workspaceId]);

  useEffect(() => { changeNavTitle(title); }, [title, changeNavTitle]);

  useEffect(() => {
    const controller = new AbortController();
    request.current?.abort();
    requestVersion.current++;
    snapshotId.current = '';
    setWorkspace(null); setResults({}); setFilterOptions({}); setCatalog({}); setFilters({});
    setViewLoading(true); setRendering(false); setRefreshing(false); setError(''); setSnapshotExpired(false);
    analytics.get<WorkspaceView>(`/v2/workspaces/${encodeURIComponent(workspaceId)}/view`, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setWorkspace(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setViewLoading(false); });
    return () => controller.abort();
  }, [workspaceId]);

  useEffect(() => {
    if (workspace) void renderSection(activeFilters);
  }, [workspace?._id, filterSignature, googleToken, connectionVersion, renderSection]);

  useEffect(() => () => request.current?.abort(), []);

  const widgets = workspace?._id === workspaceId ? workspace.widgets : [];
  const counters = widgets.filter(widget => widget.config.chart_type === 'indicator');
  const charts = widgets.filter(widget => widget.config.chart_type !== 'indicator');
  const retry = () => { void renderSection(activeFilters); };
  const refreshData = () => { void renderSection(activeFilters, true); };
  const handleConnectionChange = () => {
    snapshotId.current = '';
    setResults({}); setFilterOptions({}); setSnapshotExpired(false);
    setConnectionVersion(version => version + 1);
  };
  const renderWidget = (widget: Widget) => <SavedChart key={widget.id} widget={widget} rendered={results[widget.id]}
    updating={rendering} onRetry={retry} />;
  const busy = viewLoading || rendering;
  const statusText = viewLoading ? 'Cargando sección…' : rendering
    ? (refreshing ? 'Actualizando datos…' : 'Aplicando filtros…')
    : 'Los filtros se aplican a los gráficos compatibles de la sección';

  return <main className="generator saved-dashboard">
    {dashboardPath && <Link className="generator-link-button" to={dashboardPath}>← Volver a {dashboardName}</Link>}
    <header className="generator-hero">
      <div><span className="generator-eyebrow">SECCIÓN · {dashboardName || 'GRÁFICOS'}</span><h1>{title}</h1><p>{workspace?.widgets.length ?? '…'} {workspace?.widgets.length === 1 ? 'gráfico' : 'gráficos'} · {statusText}</p></div>
      <div className="generator-controls"><button onClick={refreshData} disabled={busy || !workspace}><Icon icon="material-symbols:refresh" width={20} /> Actualizar datos</button>
        {workspace?.can_edit && <Link className="generator-link-button" to={`/generador?editar=${encodeURIComponent(workspaceId)}`}><Icon icon="material-symbols:edit-outline" width={20} /> Editar gráficos y accesos</Link>}
      </div>
    </header>
    {error && <p role="alert" className="generator-error">{error} <button type="button" onClick={snapshotExpired ? refreshData : retry} disabled={busy}>{snapshotExpired ? 'Actualizar datos' : 'Reintentar'}</button></p>}
    {workspace?.source_kind === 'google' && (workspace.source_access_mode === 'public'
      ? <p className="generator-hint">Google Sheets · Los datos se leen al entrar o al usar Actualizar datos.</p>
      : <GoogleConnectionPanel token={googleToken} onToken={setGoogleToken} onConnectionChange={handleConnectionChange} busy={busy} />)}
    {workspace && columns.length > 0 && <SectionFilterBar columns={columns} options={filterOptions} values={activeFilters} loading={rendering} onChange={setFilters} />}
    {counters.length > 0 && <section className="generator-counters" aria-label="Contadores de la sección">{counters.map(renderWidget)}</section>}
    {charts.length > 0 && <div className="generator-grid">{charts.map(renderWidget)}</div>}
  </main>;
}
