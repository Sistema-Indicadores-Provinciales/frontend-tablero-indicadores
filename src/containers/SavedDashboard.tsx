import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { analytics, errorMessage } from 'config/Analytics';
import GoogleConnectionPanel from 'components/analytics/GoogleConnectionPanel';
import NavbarContext from 'contexts/NavbarContext';
import { ChartData, WorkspaceView } from 'types/Generator';
import GeneratorChart from 'components/analytics/GeneratorChart';
import './chart-generator.css';

export default function SavedDashboard({ workspaceId, title, dashboardName, dashboardPath }: { workspaceId: string; title: string; dashboardName?: string; dashboardPath?: string }) {
  const { changeNavTitle } = useContext(NavbarContext);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [results, setResults] = useState<Record<string, ChartData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [googleToken, setGoogleToken] = useState('');
  const [updated, setUpdated] = useState('');
  useEffect(() => { changeNavTitle(title); }, [title]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(''); setResults({}); setErrors({}); setUpdated('');
    const run = async () => {
      try {
        const { data } = await analytics.get<WorkspaceView>(`/v2/workspaces/${workspaceId}/view`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setWorkspace(data);
        const queue = [...data.widgets];
        const worker = async () => {
          while (queue.length && !controller.signal.aborted) {
            const widget = queue.shift()!;
            try {
              const response = await analytics.get<ChartData>(`/v2/workspaces/${workspaceId}/widgets/${encodeURIComponent(widget.id)}/chart`, {
                signal: controller.signal, headers: googleToken ? { 'X-Google-Access-Token': googleToken } : {},
              });
              if (!controller.signal.aborted) setResults(prev => ({ ...prev, [widget.id]: response.data }));
            } catch (e) { if (!controller.signal.aborted) setErrors(prev => ({ ...prev, [widget.id]: errorMessage(e) })); }
          }
        };
        await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
        if (!controller.signal.aborted) setUpdated(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
      } catch (e) { if (!controller.signal.aborted) { setWorkspace(null); setError(errorMessage(e)); } }
      finally { if (!controller.signal.aborted) setBusy(false); }
    };
    run();
    return () => controller.abort();
  }, [workspaceId, refresh, googleToken]);
  return <main className="generator saved-dashboard">
    {dashboardPath && <Link className="generator-link-button" to={dashboardPath}>← Volver a {dashboardName}</Link>}
    <header className="generator-hero">
      <div><span className="generator-eyebrow">SECCIÓN · {dashboardName || 'GRÁFICOS'}</span><h1>{title}</h1><p>{workspace?.widgets.length ?? '…'} {workspace?.widgets.length === 1 ? 'gráfico' : 'gráficos'} · {busy ? 'Actualizando datos…' : updated ? `Última consulta ${updated}` : 'Datos guardados en esta sección'}</p></div>
      <div className="generator-controls"><button onClick={() => setRefresh(v => v + 1)} disabled={busy}><Icon icon="material-symbols:refresh" width={20} /> Actualizar datos</button>
        {workspace?.can_edit && <Link className="generator-link-button" to={`/generador?editar=${encodeURIComponent(workspaceId)}`}><Icon icon="material-symbols:edit-outline" width={20} /> Editar gráficos y accesos</Link>}
      </div>
    </header>
    {error && <p role="alert" className="generator-error">{error}</p>}
    {workspace?.source_kind === 'google' && (workspace.source_access_mode === 'public'
      ? <p className="generator-hint">Google Sheets · Enlace público. No hace falta conectar una cuenta para actualizar estos gráficos.</p>
      : <GoogleConnectionPanel token={googleToken} onToken={setGoogleToken} busy={busy} />)}
    <div className="generator-grid">{workspace?.widgets.map(w => <section className="generator-panel generator-widget" key={w.id} style={{ gridColumn: `span ${w.width}` }}>
      <h2>{w.title}</h2>
      {errors[w.id] ? <p role="alert" className="generator-error">{errors[w.id]}</p> : results[w.id] ? <>
        <p className="generator-hint">{results[w.id].filtered_rows.toLocaleString('es-AR')} registros</p>
        <GeneratorChart widget={w} result={results[w.id]} />
        {!!results[w.id].warnings.length && <details className="generator-hint"><summary>Notas sobre los datos</summary>{results[w.id].warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details>}
      </> : <p role="status" className="generator-loading">Cargando gráfico…</p>}
    </section>)}</div>
  </main>;
}
