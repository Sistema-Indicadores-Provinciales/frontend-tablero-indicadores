import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { analytics, errorMessage } from 'config/Analytics';
import GoogleConnectionPanel from 'components/analytics/GoogleConnectionPanel';
import NavbarContext from 'contexts/NavbarContext';
import { WorkspaceView } from 'types/Generator';
import SavedChart from 'components/analytics/SavedChart';
import './chart-generator.css';

export default function SavedDashboard({ workspaceId, title, dashboardName, dashboardPath }: { workspaceId: string; title: string; dashboardName?: string; dashboardPath?: string }) {
  const { changeNavTitle } = useContext(NavbarContext);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [googleToken, setGoogleToken] = useState('');
  useEffect(() => { changeNavTitle(title); }, [title]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError('');
    const run = async () => {
      try {
        const { data } = await analytics.get<WorkspaceView>(`/v2/workspaces/${workspaceId}/view`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setWorkspace(data);
      } catch (e) { if (!controller.signal.aborted) { setWorkspace(null); setError(errorMessage(e)); } }
      finally { if (!controller.signal.aborted) setBusy(false); }
    };
    run();
    return () => controller.abort();
  }, [workspaceId, refresh]);
  return <main className="generator saved-dashboard">
    {dashboardPath && <Link className="generator-link-button" to={dashboardPath}>← Volver a {dashboardName}</Link>}
    <header className="generator-hero">
      <div><span className="generator-eyebrow">SECCIÓN · {dashboardName || 'GRÁFICOS'}</span><h1>{title}</h1><p>{workspace?.widgets.length ?? '…'} {workspace?.widgets.length === 1 ? 'gráfico' : 'gráficos'} · {busy ? 'Cargando sección…' : 'Explorá los datos con los filtros de cada gráfico'}</p></div>
      <div className="generator-controls"><button onClick={() => setRefresh(v => v + 1)} disabled={busy}><Icon icon="material-symbols:refresh" width={20} /> Actualizar datos</button>
        {workspace?.can_edit && <Link className="generator-link-button" to={`/generador?editar=${encodeURIComponent(workspaceId)}`}><Icon icon="material-symbols:edit-outline" width={20} /> Editar gráficos y accesos</Link>}
      </div>
    </header>
    {error && <p role="alert" className="generator-error">{error}</p>}
    {workspace?.source_kind === 'google' && (workspace.source_access_mode === 'public'
      ? <p className="generator-hint">Google Sheets · Enlace público. No hace falta conectar una cuenta para actualizar estos gráficos.</p>
      : <GoogleConnectionPanel token={googleToken} onToken={setGoogleToken} onConnectionChange={() => setRefresh(v => v + 1)} busy={busy} />)}
    <div className="generator-grid">{workspace?._id === workspaceId && workspace.widgets.map(w => <SavedChart key={`${workspaceId}:${w.id}`} workspaceId={workspaceId} widget={w} googleToken={googleToken} />)}</div>
  </main>;
}
