import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { AuthContext } from 'contexts/AuthContext';
import SaveDashboardDialog from 'components/analytics/SaveDashboardDialog';
import { analytics, errorMessage } from 'config/Analytics';
import GoogleConnectionPanel from 'components/analytics/GoogleConnectionPanel';
import NavbarContext from 'contexts/NavbarContext';
import { ChartData, ChartType, DestinationOption, Preview, Publication, ReadConfig, SectionOptions, Source, Widget, Workspace, chartNames } from 'types/Generator';
import GeneratorChart from 'components/analytics/GeneratorChart';
import './chart-generator.css';

const initialRead: ReadConfig = { sheet: '', header_row: 1, decimal: ',', types: {} };
function newWidget(): Widget {
  return { id: crypto.randomUUID(), title: 'Mi gráfico', width: 12, library: 'Plotly', config: {
    ...initialRead, chart_type: 'bar', aggregation: 'count', x_col: '', y_col: '', group_col: '', date_bucket: 'none', filters: {},
  } };
}
const operations: Record<string, string> = { count: 'Contar registros', sum: 'Sumar', mean: 'Promedio', median: 'Mediana', min: 'Mínimo', max: 'Máximo', distinct: 'Contar valores distintos' };
export default function ChartGenerator() {
  const { refreshAccessKeynames } = useContext(AuthContext);
  const { changeNavTitle } = useContext(NavbarContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get('editar') || '';
  const dashboardId = searchParams.get('tablero') || '', sectionId = searchParams.get('seccion') || '';
  const [destination, setDestination] = useState<DestinationOption | null>(null);
  const [targetLoading, setTargetLoading] = useState(false), [targetError, setTargetError] = useState('');
  const [targetRetry, setTargetRetry] = useState(0);
  const loadedEdit = useRef('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [publication, setPublication] = useState<Publication | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [sheets, setSheets] = useState<string[]>([]);
  const [read, setRead] = useState<ReadConfig>(initialRead);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([newWidget()]);
  const [results, setResults] = useState<Record<string, ChartData>>({});
  const [chartErrors, setChartErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [googleToken, setGoogleToken] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [name, setName] = useState('Mi tablero');
  const requests = useRef<Record<string, AbortController>>({});
  const source = sources.find(s => s._id === sourceId);
  const headers = googleToken ? { 'X-Google-Access-Token': googleToken } : {};
  const invalidate = () => {
    Object.values(requests.current).forEach(r => r.abort()); requests.current = {};
    setResults({}); setRunning({}); setChartErrors({}); setNotice('');
  };
  const reloadLists = async () => {
    const [s, w] = await Promise.all([analytics.get<Source[]>('/v2/sources'), analytics.get<Workspace[]>('/v2/workspaces')]);
    setSources(s.data); setWorkspaces(w.data);
  };
  const restoreSavedMenu = async () => {
    try {
      const { data } = await analytics.post<{ restored: number }>('/v2/workspaces/restore-menu');
      if (data.restored) {
        await refreshAccessKeynames();
        setNotice(`${data.restored} ${data.restored === 1 ? 'tablero recuperado' : 'tableros recuperados'} en el menú lateral. Podés elegir quién los ve al guardar.`);
      }
    } catch (e) { setError('No se pudo actualizar el menú de los tableros guardados. Usá Actualizar lista para reintentar. ' + errorMessage(e)); }
    await reloadLists();
  };
  useEffect(() => {
    restoreSavedMenu().catch(e => setError(errorMessage(e)));
    changeNavTitle('Generador de gráficos');
    return () => { Object.values(requests.current).forEach(r => r.abort()); };
  }, []);
  useEffect(() => {
    if (editId) return;
    setDestination(null); setTargetError('');
    if (!dashboardId && !sectionId) {
      setTargetLoading(false);
      if (loadedEdit.current) {
        loadedEdit.current = ''; setWorkspaceId(''); setPublication(null); setSourceId(''); setRead(initialRead); setFilters({}); setWidgets([newWidget()]); setName('Mi tablero'); invalidate();
      }
      return;
    }
    const controller = new AbortController();
    setTargetLoading(true); setWorkspaceId(''); loadedEdit.current = '';
    analytics.get<SectionOptions>(`/v2/dashboards/${encodeURIComponent(dashboardId)}/sections/${encodeURIComponent(sectionId)}/options`, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (data.workspaceId) { setSearchParams({ editar: data.workspaceId }, { replace: true }); return; }
        if (!data.canAddCharts) throw new Error('Esta sección tiene una página propia y no admite gráficos del generador.');
        setDestination(data); setName(data.sectionName);
      }).catch(e => { if (!controller.signal.aborted) setTargetError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setTargetLoading(false); });
    return () => controller.abort();
  }, [dashboardId, sectionId, editId, targetRetry]);
  useEffect(() => {
    setSheets([]); setPreview(null);
    if (!sourceId) return;
    const controller = new AbortController();
    analytics.get<string[]>(`/v2/sources/${encodeURIComponent(sourceId)}/sheets`, { headers, signal: controller.signal })
      .then(({ data }) => { setSheets(data); setRead(prev => ({ ...prev, sheet: data.includes(prev.sheet) ? prev.sheet : data[0] || '' })); })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); });
    return () => controller.abort();
  }, [sourceId, googleToken]);
  useEffect(() => {
    setPreview(null);
    if (!sourceId || !read.sheet) return;
    const controller = new AbortController();
    setReading(true); setError('');
    analytics.post<Preview>(`/v2/sources/${encodeURIComponent(sourceId)}/preview`, read, { headers, signal: controller.signal })
      .then(({ data }) => {
        setPreview(data);
        setWidgets(prev => prev.map(w => ({ ...w, config: { ...w.config,
          x_col: data.columns.includes(w.config.x_col) ? w.config.x_col : data.columns[0],
          y_col: data.columns.includes(w.config.y_col) ? w.config.y_col : data.columns.find(c => data.column_meta[c].type === 'number') || data.columns[0],
        } })));
      })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setReading(false); });
    return () => controller.abort();
  }, [sourceId, read, googleToken]);
  const selectSource = (id: string) => {
    invalidate(); setPublication(null); setSourceId(id); setRead(initialRead); setFilters({});
    if (!workspaceId) setWidgets([newWidget()]);
    setError('');
  };
  const changeRead = (patch: Partial<ReadConfig>) => { invalidate(); setRead(prev => ({ ...prev, ...patch })); setFilters({}); };
  const patchWidget = (id: string, patch: Partial<Widget>) => {
    requests.current[id]?.abort();
    setResults(prev => { const next = { ...prev }; delete next[id]; return next; });
    setRunning(prev => ({ ...prev, [id]: false }));
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  };
  const generate = async (widget: Widget) => {
    requests.current[widget.id]?.abort();
    const controller = new AbortController(); requests.current[widget.id] = controller;
    setResults(prev => { const next = { ...prev }; delete next[widget.id]; return next; });
    setRunning(prev => ({ ...prev, [widget.id]: true })); setChartErrors(prev => ({ ...prev, [widget.id]: '' }));
    try {
      const { data } = await analytics.post<ChartData>(`/v2/sources/${encodeURIComponent(sourceId)}/chart`, { ...widget.config, ...read, filters }, { headers, signal: controller.signal });
      if (!controller.signal.aborted) setResults(prev => ({ ...prev, [widget.id]: data }));
    } catch (e) { if (!controller.signal.aborted) setChartErrors(prev => ({ ...prev, [widget.id]: errorMessage(e) })); }
    finally { if (!controller.signal.aborted) setRunning(prev => ({ ...prev, [widget.id]: false })); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('El archivo supera 25 MB.');
      const form = new FormData(); form.append('file', file);
      const { data } = await analytics.post<Source>('/v2/sources/upload', form);
      setSources(prev => [...prev, data]); selectSource(data._id);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const linkGoogle = async (url: string, token: string) => {
    setBusy(true); setError('');
    try {
      const { data } = await analytics.post<Source>('/v2/sources/google', { url }, { headers: token ? { 'X-Google-Access-Token': token } : {} });
      setSources(prev => [...prev, data]); selectSource(data._id);
    } finally { setBusy(false); }
  };
  const save = async (savedName: string, icon: string, recipients?: string[], selectedDestination?: DestinationOption) => {
    setBusy(true); setError(''); setSaveError('');
    let contentSaved = false;
    try {
      const target = selectedDestination || destination;
      const body = { name: savedName, source_id: sourceId, widgets: widgets.map(w => ({ ...w, config: { ...w.config, ...read, filters } })),
        ...(target ? { destination: { dashboardId: target.dashboardId, sectionId: target.sectionId } } : {}) };
      const { data } = workspaceId ? await analytics.put<Workspace>(`/v2/workspaces/${workspaceId}`, body) : await analytics.post<Workspace>('/v2/workspaces', body);
      contentSaved = true; setWorkspaceId(data._id); setName(savedName);
      if (target) setDestination(target);
      loadedEdit.current = data._id; setSearchParams({ editar: data._id }, { replace: true });
      const linked = await analytics.put<Publication>(`/v2/workspaces/${data._id}/publication`, { icon, ...(recipients ? { recipientIds: recipients } : {}) });
      setPublication(linked.data);
      await reloadLists(); await refreshAccessKeynames();
      setSaveOpen(false);
      setNotice(target ? `Gráficos guardados en ${target.dashboardName} → ${target.sectionName}. Se aplicaron los accesos elegidos para esta sección.` : linked.data.canView ? 'Tablero guardado. Ya aparece en el menú lateral y en el índice, con los accesos que elegiste.'
        : linked.data.show ? 'Tablero guardado con los accesos seleccionados. Tu usuario no tiene acceso para verlo en el menú.'
        : 'Tablero guardado. Un administrador debe habilitar el tablero y su sección desde Tableros para mostrarlo en el menú.');
    } catch (e) { setSaveError((contentSaved ? 'Los gráficos quedaron guardados, pero falta completar la actualización del menú y los accesos. Reintentá guardar. ' : '') + errorMessage(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!editId || loadedEdit.current === editId) return;
    const controller = new AbortController();
    setError('');
    setTargetLoading(true); setTargetError('');
    analytics.get<Workspace>(`/v2/workspaces/${encodeURIComponent(editId)}`, { signal: controller.signal }).then(async ({ data: saved }) => {
      if (controller.signal.aborted) return;
      if (saved.destination) {
        const { data } = await analytics.get<Publication>(`/v2/workspaces/${encodeURIComponent(editId)}/publication`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!data.destination) throw new Error('No se pudo identificar la sección de estos gráficos.');
        setDestination(data.destination);
      } else setDestination(null);
      loadedEdit.current = editId;
      invalidate(); setPublication(null); setSourceId(saved.source_id); setName(saved.name); setWorkspaceId(editId); setWidgets(saved.widgets);
      const cfg = saved.widgets[0]?.config;
      setRead(cfg ? { sheet: cfg.sheet, header_row: cfg.header_row, decimal: cfg.decimal, types: cfg.types } : initialRead);
      setFilters(cfg?.filters || {}); setNotice('Estás editando gráficos guardados. Usá Agregar gráfico para sumar otro; al guardar se conservarán los demás.');
    }).catch(e => { if (!controller.signal.aborted) setTargetError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setTargetLoading(false); });
    return () => controller.abort();
  }, [editId, targetRetry]);
  const openWorkspace = (id: string) => { if (id) setSearchParams({ editar: id }, { replace: true }); };
  const move = (index: number, offset: number) => setWidgets(prev => {
    const next = [...prev]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next;
  });
  return <main className="generator">
    <header className="generator-hero"><div><span className="generator-eyebrow">TUS DATOS, EN UN TABLERO</span><h1>Generador de gráficos</h1><p>Elegí tus datos, armá los gráficos y compartí el tablero desde el menú.</p></div><Icon icon="material-symbols:monitoring-rounded" width={64} /></header>
    {error && <p role="alert" className="generator-error">{error}</p>}
    {targetLoading && <p role="status">Cargando sección…</p>}
    {targetError && <p role="alert" className="generator-error">{targetError} <button onClick={() => setTargetRetry(v => v + 1)}>Reintentar</button></p>}
    {destination && <section className="generator-panel generator-library"><h2>Agregando gráficos a {destination.sectionName}</h2><p>Tablero: <strong>{destination.dashboardName}</strong> → Sección: <strong>{destination.sectionName}</strong></p><p className="generator-hint">Al guardar, los gráficos quedarán dentro de esta sección y podrás revisar quién puede verla.</p><Link className="generator-link-button" to={destination.path.substring(0, destination.path.lastIndexOf('/'))}>Volver al tablero</Link></section>}
    {notice && <div role="status" className="generator-notice">{notice}{publication?.canView && publication.path && <Link className="generator-link-button" to={publication.path}>{destination ? 'Ver sección' : 'Ver tablero'} <Icon icon="material-symbols:arrow-forward" width={20} /></Link>}</div>}
    <section className="generator-panel generator-controls generator-library"><div><h2>Continuar un tablero</h2><p className="generator-hint">Los tableros guardados aparecen en el menú. Abrilos aquí para editar sus gráficos y accesos.</p></div>
      <label>Tableros guardados<select value={workspaceId} onChange={e => openWorkspace(e.target.value)} disabled={busy}><option value="">Elegir tablero para editar</option>{workspaces.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}</select></label>
      <button onClick={() => restoreSavedMenu().catch(e => setError(errorMessage(e)))} disabled={busy}>Actualizar lista</button>
    </section>
    <section className="generator-panel"><h2>1. Fuente de datos</h2>
      <div className="generator-controls">
        <label>Archivos disponibles<select value={sourceId} onChange={e => selectSource(e.target.value)} disabled={busy}><option value="">Elegir fuente</option>{sources.map(s => <option key={s._id} value={s._id}>{s.name} ({s.kind === 'system' ? 'sistema' : s.kind === 'google' ? 'Google Sheets' : 'propio'})</option>)}</select></label>
      </div>
      <label className="generator-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) upload(e.dataTransfer.files[0]); }}>
        Subir archivo o arrastrarlo aquí · XLSX, XLSM, XLS, CSV, TSV · hasta 25 MB
        <input aria-label="Subir archivo" type="file" accept=".xlsx,.xlsm,.xls,.csv,.tsv" disabled={busy} onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      <GoogleConnectionPanel token={googleToken} onToken={token => { invalidate(); setGoogleToken(token); }} busy={busy} onUseSheet={linkGoogle} />
      {busy && <p role="status">Procesando…</p>}
    </section>
    {sourceId && <section className="generator-panel"><h2>2. Revisar la lectura · {source?.name}</h2>
      <div className="generator-controls">
        <label>Hoja<select value={read.sheet} onChange={e => changeRead({ sheet: e.target.value, types: {} })}><option value="">Elegir hoja</option>{sheets.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Fila de encabezados (0 = sin encabezados)<input type="number" min={0} max={100000} value={read.header_row} onChange={e => changeRead({ header_row: Math.max(0, Number(e.target.value)), types: {} })} /></label>
        <label>Formato de números<select value={read.decimal} onChange={e => changeRead({ decimal: e.target.value })}><option value=",">1.234,56</option><option value=".">1,234.56</option></select></label>
        <button onClick={() => { invalidate(); setRead(prev => ({ ...prev })); }}>Actualizar datos</button>
      </div>
      {reading && <p role="status">Leyendo datos…</p>}
      {preview && <>
        <p>{preview.row_count.toLocaleString('es-AR')} filas · {preview.columns.length} columnas. Vista previa: primeras 20 filas.</p>
        {preview.warnings.map((w, i) => <p className="generator-hint" key={i}>{w}</p>)}
        <details><summary>Ver primeras filas originales (para ubicar los encabezados)</summary><div className="generator-table"><table><tbody>{preview.raw_preview.map((r, i) => <tr key={i}><th>{i + 1}</th>{r.map((v, j) => <td key={j}>{String(v ?? '')}</td>)}</tr>)}</tbody></table></div></details>
        <div className="generator-table"><table><thead><tr>{preview.columns.map(c => <th key={c}>{c}<select aria-label={`Tipo de ${c}`} value={read.types[c] || 'auto'} onChange={e => changeRead({ types: { ...read.types, [c]: e.target.value } })}><option value="auto">Detectar ({preview.column_meta[c].type})</option><option value="text">Texto</option><option value="number">Número / porcentaje</option><option value="date">Fecha</option><option value="boolean">Sí / No</option></select></th>)}</tr></thead><tbody>{preview.preview.map((r, i) => <tr key={i}>{preview.columns.map(c => <td key={c}>{String(r[c] ?? '—')}</td>)}</tr>)}</tbody></table></div>
      </>}
    </section>}
    {preview && <>
      <section className="generator-panel"><h2>3. Filtros</h2><p className="generator-hint">Sin selección se incluyen todos los valores. Después de cambiar filtros, generá nuevamente cada gráfico.</p><div className="generator-controls">
        {preview.columns.map(c => <label key={c}>{c}<input placeholder="Valores separados por ;" value={(filters[c] || []).join(';')} onChange={e => { invalidate(); setFilters(prev => ({ ...prev, [c]: e.target.value ? e.target.value.split(';') : [] })); }} list={`values-${encodeURIComponent(c)}`} /><datalist id={`values-${encodeURIComponent(c)}`}>{preview.column_meta[c].unique_values.map((v, i) => <option key={i} value={String(v)} />)}</datalist></label>)}
        <button onClick={() => { invalidate(); setFilters({}); }}>Limpiar filtros</button>
      </div></section>
      <section className="generator-controls generator-panel">
        {destination ? <strong>{destination.dashboardName} → {destination.sectionName}</strong> : <label>Nombre del tablero<input value={name} maxLength={200} onChange={e => setName(e.target.value)} /></label>}
        <button disabled={busy || targetLoading || !!targetError || !name.trim() || !widgets.length} className="generator-primary" onClick={() => { setSaveError(''); setSaveOpen(true); }}>{destination ? 'Guardar en esta sección' : 'Guardar tablero'}</button>
        <button disabled={busy} onClick={() => { setWorkspaceId(''); setPublication(null); setDestination(null); setTargetError(''); setSearchParams({}, { replace: true }); loadedEdit.current = ''; setName(name + ' (copia)'); setNotice('Se guardará una copia. Al guardar podés elegir otra sección vacía o crear un tablero nuevo.'); }}>Guardar como nuevo</button>
        <button disabled={widgets.length >= 30} onClick={() => setWidgets(prev => [...prev, { ...newWidget(), config: { ...newWidget().config, x_col: preview.columns[0], y_col: preview.columns.find(c => preview.column_meta[c].type === 'number') || preview.columns[0] } }])}>Agregar gráfico</button>
      </section>
      <div className="generator-grid">{widgets.map((w, index) => <section key={w.id} className="generator-panel generator-widget" style={{ gridColumn: `span ${w.width}` }}>
        <div className="generator-controls"><label>Título<input value={w.title} onChange={e => patchWidget(w.id, { title: e.target.value })} /></label><label>Ancho<select value={w.width} onChange={e => patchWidget(w.id, { width: Number(e.target.value) })}><option value={12}>Completo</option><option value={6}>Mitad</option></select></label><button disabled={index === 0} onClick={() => move(index, -1)}>Subir</button><button disabled={index === widgets.length - 1} onClick={() => move(index, 1)}>Bajar</button><button onClick={() => { requests.current[w.id]?.abort(); setWidgets(prev => prev.filter(item => item.id !== w.id)); }}>Quitar</button></div>
        <div className="generator-controls">
          <label>Tipo de gráfico<select value={w.config.chart_type} onChange={e => patchWidget(w.id, { config: { ...w.config, chart_type: e.target.value as ChartType } })}>{Object.entries(chartNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Presentación<select value={w.library} onChange={e => patchWidget(w.id, { library: e.target.value as Widget['library'] })}><option>Plotly</option><option>ECharts</option></select></label>
          <label>Eje X / categoría<select value={w.config.x_col} onChange={e => patchWidget(w.id, { config: { ...w.config, x_col: e.target.value } })}>{preview.columns.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Valor / eje Y<select value={w.config.y_col} onChange={e => patchWidget(w.id, { config: { ...w.config, y_col: e.target.value } })}>{preview.columns.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Operación<select disabled={['scatter', 'box', 'histogram', 'table'].includes(w.config.chart_type)} value={w.config.aggregation} onChange={e => patchWidget(w.id, { config: { ...w.config, aggregation: e.target.value } })}>{Object.entries(operations).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Separar series<select value={w.config.group_col} onChange={e => patchWidget(w.id, { config: { ...w.config, group_col: e.target.value } })}><option value="">Sin separar</option>{preview.columns.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Agrupar fechas<select value={w.config.date_bucket} onChange={e => patchWidget(w.id, { config: { ...w.config, date_bucket: e.target.value } })}><option value="none">Sin agrupar</option><option value="month">Por mes</option><option value="year">Por año</option></select></label>
          <button className="generator-primary" disabled={reading || running[w.id]} onClick={() => generate(w)}>{running[w.id] ? 'Generando…' : 'Generar gráfico'}</button>
        </div>
        {chartErrors[w.id] && <p role="alert" className="generator-error">{chartErrors[w.id]}</p>}
        {results[w.id] && <><h3>{w.title}</h3><p className="generator-hint">{results[w.id].filtered_rows} registros · {operations[w.config.aggregation]}{['box', 'scatter', 'histogram'].includes(w.config.chart_type) ? ' (este tipo usa los valores individuales)' : ''}</p>{results[w.id].warnings.map((v, i) => <p className="generator-hint" key={i}>{v}</p>)}<GeneratorChart widget={w} result={results[w.id]} /></>}
      </section>)}</div>
    </>}
    <SaveDashboardDialog open={saveOpen} workspaceId={workspaceId} name={name} destination={destination} busy={busy} error={saveError} count={widgets.length} onClose={() => setSaveOpen(false)} onSave={save} />
  </main>;
}
