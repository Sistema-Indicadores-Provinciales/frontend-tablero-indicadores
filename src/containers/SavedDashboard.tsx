import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { analytics, errorMessage } from 'config/Analytics';
import GoogleConnectionPanel from 'components/analytics/GoogleConnectionPanel';
import NavbarContext from 'contexts/NavbarContext';
import { FilterOptions, SectionFilters, WorkspaceView } from 'types/Generator';
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
  const [optionsByChart, setOptionsByChart] = useState<Record<string, FilterOptions>>({});
  const [filters, setFilters] = useState<SectionFilters>({});
  const onOptions = useCallback((id: string, options: FilterOptions | null, deniedMessage?: string) => {
    if (deniedMessage) { setWorkspace(null); setOptionsByChart({}); setFilters({}); setError(deniedMessage); return; }
    setOptionsByChart(previous => {
      const next = { ...previous };
      if (options) next[id] = options; else delete next[id];
      return next;
    });
  }, []);
  const options = useMemo(() => {
    const merged: FilterOptions = {};
    for (const widget of workspace?.widgets || []) {
      for (const [column, option] of Object.entries(optionsByChart[widget.id] || {})) {
        const values = [...new Set([...(merged[column]?.values || []), ...option.values])];
        merged[column] = { values: values.slice(0, 100), total: Math.max(values.length, merged[column]?.total || 0, option.total), type: option.type };
      }
    }
    return merged;
  }, [optionsByChart, workspace]);
  const legacyColumns = new Set(workspace?.widgets.flatMap(({ config }) => [config.x_col, config.y_col, config.group_col, ...Object.keys(config.filters || {})]));
  const legacyOptions = Object.fromEntries(Object.entries(options).filter(([column]) => legacyColumns.has(column)));
  // Keep active controls visible even if a temporary source error clears their suggestions.
  const columns = workspace?.filter_columns ?? [...new Set([...suggestFilterColumns(legacyOptions), ...Object.keys(filters).filter(c => filters[c].length)])];
  const signature = JSON.stringify(Object.fromEntries(Object.entries(filters).filter(([column, values]) => columns.includes(column) && values.length)));
  const activeFilters = useMemo<SectionFilters>(() => JSON.parse(signature), [signature]);
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
    {workspace && columns.length > 0 && <SectionFilterBar columns={columns} options={options} values={activeFilters} onChange={setFilters} />}
    <div className="generator-grid">{workspace?._id === workspaceId && workspace.widgets.map(w => <SavedChart key={`${workspaceId}:${w.id}`} workspaceId={workspaceId} widget={w} googleToken={googleToken} filters={activeFilters} onOptions={onOptions} />)}</div>
  </main>;
}
