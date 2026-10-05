import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { analytics, errorMessage } from 'config/Analytics';
import GoogleConnectionPanel from 'components/analytics/GoogleConnectionPanel';
import NavbarContext from 'contexts/NavbarContext';
import { ChartFilterOptions, FilterOptions, SectionFilters, Widget, WorkspaceView } from 'types/Generator';
import SavedChart from 'components/analytics/SavedChart';
import SectionFilterBar from 'components/analytics/SectionFilterBar';
import { suggestFilterColumns } from 'utils/sectionFilters';
import './chart-generator.css';

type Props = { workspaceId: string; title: string; dashboardName?: string; dashboardPath?: string };
export default function SavedDashboard(props: Props) { return <SectionDashboard key={props.workspaceId} {...props} />; }

function SectionDashboard({ workspaceId, title, dashboardName, dashboardPath }: Props) {
  const { changeNavTitle } = useContext(NavbarContext);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [googleToken, setGoogleToken] = useState('');
  const [optionsByChart, setOptionsByChart] = useState<Record<string, ChartFilterOptions>>({});
  const [catalogByChart, setCatalogByChart] = useState<Record<string, FilterOptions>>({});
  const [filters, setFilters] = useState<SectionFilters>({});
  const previousOptions = useRef<FilterOptions>({});
  const onOptions = useCallback((response: ChartFilterOptions, deniedMessage?: string) => {
    if (deniedMessage) { setWorkspace(null); setOptionsByChart({}); setCatalogByChart({}); setFilters({}); setError(deniedMessage); return; }
    setOptionsByChart(previous => ({ ...previous, [response.widget.id]: response }));
    // Retain field metadata (not stale values) so legacy controls do not disappear
    // while a request is pending or when another filter narrows their cardinality.
    if (response.options) setCatalogByChart(previous => ({ ...previous, [response.widget.id]: Object.fromEntries(
      Object.entries(response.options!).map(([column, option]) => [column, { values: [], type: option.type, total: option.unfiltered_total ?? option.total }]),
    ) }));
  }, []);
  const catalog = useMemo(() => {
    const merged: FilterOptions = {};
    for (const widget of workspace?.widgets || []) {
      for (const [column, option] of Object.entries(catalogByChart[widget.id] || {})) {
        merged[column] = { ...option, total: Math.max(merged[column]?.total || 0, option.total) };
      }
    }
    return merged;
  }, [catalogByChart, workspace]);
  const legacyColumns = new Set(workspace?.widgets.flatMap(({ config }) => [config.x_col, config.y_col, config.group_col, ...Object.keys(config.filters || {})]));
  const legacyOptions = Object.fromEntries(Object.entries(catalog).filter(([column]) => legacyColumns.has(column)));
  // Keep active controls visible even if a temporary source error clears their suggestions.
  const columns = workspace?.filter_columns ?? [...new Set([...suggestFilterColumns(legacyOptions), ...Object.keys(filters).filter(c => filters[c].values.length)])];
  const signature = JSON.stringify(Object.fromEntries(Object.entries(filters).filter(([column, selection]) => columns.includes(column) && selection.values.length)));
  const activeFilters = useMemo<SectionFilters>(() => JSON.parse(signature), [signature]);
  const loadingOptions = !!workspace?.widgets.some(widget => {
    const entry = optionsByChart[widget.id];
    return entry?.widget !== widget || entry.filters !== activeFilters || entry.options === undefined;
  });
  const options = useMemo(() => {
    const merged: FilterOptions = {}, ranks: Record<string, number> = {};
    // Publish one coherent set of choices, never a mixture of old/new chart responses.
    if (loadingOptions) return merged;
    for (const widget of workspace?.widgets || []) {
      const entry = optionsByChart[widget.id];
      if (entry?.widget !== widget || entry.filters !== activeFilters) continue;
      const rank = entry.ignoredFilters?.length || 0;
      for (const [column, option] of Object.entries(entry.options || {})) {
        // A sheet missing e.g. Mes must not reintroduce choices discarded by sheets
        // which can apply it. Prefer the most compatible charts for each field.
        if (ranks[column] !== undefined && rank > ranks[column]) continue;
        if (ranks[column] !== rank) delete merged[column];
        ranks[column] = rank;
        const previous = merged[column];
        const values = [...new Set([...(previous?.values || []), ...option.values])];
        const selected = activeFilters[column]?.values || [];
        const available = option.available_selected ?? selected.filter(value => option.values.includes(value) || option.total > option.values.length);
        merged[column] = { values: values.slice(0, 100), total: Math.max(values.length, previous?.total || 0, option.total), type: option.type,
          available_selected: [...new Set([...(previous?.available_selected || []), ...available])] };
      }
    }
    return merged;
  }, [optionsByChart, workspace, activeFilters, loadingOptions]);
  useEffect(() => {
    if (loadingOptions) return;
    const previous = previousOptions.current;
    setFilters(current => {
      const next = { ...current };
      let changed = false;
      for (const [column, option] of Object.entries(options)) {
        const selection = current[column];
        if (selection?.mode !== 'include') continue;
        const known = new Set(previous[column]?.values || []);
        const selected = new Set(selection.values);
        const newlyAvailable = option.values.filter(value => !known.has(value) && !selected.has(value));
        const added = newlyAvailable.slice(0, Math.max(0, 100 - selection.values.length));
        if (added.length) {
          next[column] = { mode: 'include', values: [...selection.values, ...added] };
          changed = true;
        }
      }
      return changed ? next : current;
    });
    previousOptions.current = options;
  }, [options, loadingOptions]);
  useEffect(() => { changeNavTitle(title); }, [title]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError('');
    const run = async () => {
      try {
        const { data } = await analytics.get<WorkspaceView>(`/v2/workspaces/${workspaceId}/view`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setWorkspace(data);
      } catch (e) { if (!controller.signal.aborted) { setWorkspace(null); setOptionsByChart({}); setFilters({}); setError(errorMessage(e)); } }
      finally { if (!controller.signal.aborted) setBusy(false); }
    };
    run();
    return () => controller.abort();
  }, [workspaceId, refresh]);
  const widgets = workspace?._id === workspaceId ? workspace.widgets : [];
  const counters = widgets.filter(widget => widget.config.chart_type === 'indicator');
  const charts = widgets.filter(widget => widget.config.chart_type !== 'indicator');
  const renderWidget = (widget: Widget) => <SavedChart key={`${workspaceId}:${widget.id}`} workspaceId={workspaceId} widget={widget} googleToken={googleToken} filters={activeFilters} onOptions={onOptions} />;
  return <main className="generator saved-dashboard">
    {dashboardPath && <Link className="generator-link-button" to={dashboardPath}>← Volver a {dashboardName}</Link>}
    <header className="generator-hero">
      <div><span className="generator-eyebrow">SECCIÓN · {dashboardName || 'GRÁFICOS'}</span><h1>{title}</h1><p>{workspace?.widgets.length ?? '…'} {workspace?.widgets.length === 1 ? 'gráfico' : 'gráficos'} · {busy ? 'Cargando sección…' : 'Los filtros se aplican a los gráficos compatibles de la sección'}</p></div>
      <div className="generator-controls"><button onClick={() => setRefresh(v => v + 1)} disabled={busy}><Icon icon="material-symbols:refresh" width={20} /> Actualizar datos</button>
        {workspace?.can_edit && <Link className="generator-link-button" to={`/generador?editar=${encodeURIComponent(workspaceId)}`}><Icon icon="material-symbols:edit-outline" width={20} /> Editar gráficos y accesos</Link>}
      </div>
    </header>
    {error && <p role="alert" className="generator-error">{error}</p>}
    {workspace?.source_kind === 'google' && (workspace.source_access_mode === 'public'
      ? <p className="generator-hint">Google Sheets · Enlace público. No hace falta conectar una cuenta para actualizar estos gráficos.</p>
      : <GoogleConnectionPanel token={googleToken} onToken={setGoogleToken} onConnectionChange={() => setRefresh(v => v + 1)} busy={busy} />)}
    {workspace && columns.length > 0 && <SectionFilterBar columns={columns} options={options} values={activeFilters} loading={loadingOptions} onChange={setFilters} />}
    {counters.length > 0 && <section className="generator-counters" aria-label="Contadores de la sección">{counters.map(renderWidget)}</section>}
    {charts.length > 0 && <div className="generator-grid">{charts.map(renderWidget)}</div>}
  </main>;
}
