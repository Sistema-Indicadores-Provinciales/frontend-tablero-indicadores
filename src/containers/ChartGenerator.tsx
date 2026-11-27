import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { isAxiosError } from 'axios';
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, TextField } from '@mui/material';
import { AuthContext } from 'contexts/AuthContext';
import SaveDashboardDialog from 'components/analytics/SaveDashboardDialog';
import { analytics, errorMessage } from 'config/Analytics';
import GoogleConnectionPanel from 'components/analytics/GoogleConnectionPanel';
import NavbarContext from 'contexts/NavbarContext';
import { ChartData, ChartType, ColumnAliases, DestinationOption, FilterRule, FilterSorts, NumberPresentation, PieLabelMode, Preview, Publication, ReadConfig, SectionOptions, SortAggregation, SortConfig, Source, Widget, Workspace, chartNames } from 'types/Generator';
import GeneratorChart from 'components/analytics/GeneratorChart';
import ChartNumberSettings from 'components/analytics/ChartNumberSettings';
import { suggestFilterColumns } from 'utils/sectionFilters';
import { columnLabel, defaultSort, metricColumns } from 'utils/generatorConfig';
import './chart-generator.css';

const initialRead: ReadConfig = { sheet: '', header_row: 1, decimal: ',', types: {} };
function chartRead(config: ReadConfig): ReadConfig {
  const { sheet, header_row = 1, decimal = ',', types = {}, computed_columns, aggregate_join, google_summary } = config;
  return { sheet, header_row, decimal, types, computed_columns, aggregate_join, google_summary };
}

function newWidget(read = initialRead): Widget {
  return { id: crypto.randomUUID(), title: 'Mi gráfico', width: 12, library: 'Plotly', config: {
    ...read, chart_type: 'bar', aggregation: 'count', x_col: '', y_col: '', y_cols: [], pie_label_mode: 'percent', group_col: '', date_bucket: 'none', filters: {},
    latitude_col: '', longitude_col: '', label_col: '', size_col: '', map_mode: 'markers', map_metric_cols: [],
  } };
}
const operations: Record<string, string> = { count: 'Contar registros', sum: 'Sumar', mean: 'Promedio', median: 'Mediana', min: 'Mínimo', max: 'Máximo', distinct: 'Contar valores distintos' };
const sortOperations: Record<SortAggregation, string> = {
  alphabetical: 'A-Z', max: 'Máximo', min: 'Mínimo', sum: 'Total (suma)', count: 'Recuento', distinct: 'Recuento diferenciado',
};
const sortableCharts = new Set<ChartType>(['bar', 'horizontal', 'stacked', 'line', 'area', 'pie', 'donut', 'heatmap']);
const seriesLimitCharts = new Set<ChartType>(['bar', 'horizontal', 'stacked', 'line', 'area', 'heatmap']);
const multiMetricCharts = new Set<ChartType>(['bar', 'horizontal', 'stacked', 'line', 'table']);
const supportsAdditionalMetrics = (config: Widget['config']) => (
  multiMetricCharts.has(config.chart_type) && (config.chart_type === 'table' || config.aggregation !== 'count')
);
const labelKey = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

function SortControls({ title, columns, aliases, value, fallbackField, onChange }: {
  title: string; columns: string[]; aliases: ColumnAliases; value?: SortConfig; fallbackField: string; onChange: (value?: SortConfig) => void;
}) {
  const config = { ...defaultSort(fallbackField || columns[0] || ''), ...value };
  const patch = (change: Partial<SortConfig>) => onChange({ ...config, ...change });
  return <fieldset className="generator-sort"><legend>{title}</legend><div className="generator-controls">
    <label>Campo<select aria-label={`${title}: campo`} value={config.field} onChange={event => patch({ field: event.target.value })}>
      {columns.map(column => <option key={column} value={column}>{columnLabel(column, aliases)}</option>)}
    </select></label>
    <label>Tipo de orden<select aria-label={`${title}: tipo de orden`} value={value ? config.aggregation : ''} onChange={event => {
      const aggregation = event.target.value as SortAggregation | '';
      if (aggregation) patch({ aggregation });
      else onChange();
    }}>
      <option value="">Automático</option>
      {Object.entries(sortOperations).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>Dirección<select aria-label={`${title}: dirección`} value={config.direction} onChange={event => patch({ direction: event.target.value as SortConfig['direction'] })}>
      <option value="asc">Ascendente</option><option value="desc">Descendente</option>
    </select></label>
  </div></fieldset>;
}

function mapColumnDefaults(preview: Preview) {
  const normalized = (column: string) => labelKey(column).replace(/[^a-z0-9]/g, '');
  const numeric = preview.columns.filter(column => preview.column_meta[column].type === 'number');
  const latitude = preview.columns.find(column => /^(lat|latitude|latitud)$/.test(normalized(column))) || numeric[0] || preview.columns[0];
  const longitude = preview.columns.find(column => /^(lng|lon|long|longitude|longitud)$/.test(normalized(column))) || numeric.find(column => column !== latitude) || preview.columns[1] || preview.columns[0];
  const label = preview.columns.find(column => ![latitude, longitude].includes(column) && preview.column_meta[column].type === 'text') || '';
  return { latitude, longitude, label };
}
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
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [sheetsBySource, setSheetsBySource] = useState<Record<string, string[]>>({});
  const [read, setRead] = useState<ReadConfig>(initialRead);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [widgetPreviews, setWidgetPreviews] = useState<Record<string, Preview>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});
  const [widgets, setWidgets] = useState<Widget[]>(() => [newWidget()]);
  const [changingSheetFor, setChangingSheetFor] = useState<string | null>(null);
  const [loadingSheet, setLoadingSheet] = useState('');
  const [sheetChangeError, setSheetChangeError] = useState('');
  const [results, setResults] = useState<Record<string, ChartData>>({});
  const [chartErrors, setChartErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [defaultFilters, setDefaultFilters] = useState<Record<string, string[]>>({});
  const [filterColumns, setFilterColumns] = useState<string[] | null>(null);
  const [columnAliases, setColumnAliases] = useState<ColumnAliases>({});
  const [filterSorts, setFilterSorts] = useState<FilterSorts>({});
  const [filterOptionRules, setFilterOptionRules] = useState<FilterRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [googleToken, setGoogleToken] = useState('');
  const [googleConnectionVersion, setGoogleConnectionVersion] = useState(0);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [name, setName] = useState('Mi tablero');
  const requests = useRef<Record<string, AbortController>>({});
  const sheetChangeRequest = useRef<AbortController | null>(null);
  const source = sources.find(s => s._id === sourceId);
  const sheets = sheetsBySource[sourceId];
  const sourceReady = !!source;
  const sourceMissing = sourcesLoaded && !!sourceId && !sourceReady;
  const suggestedColumns = preview ? suggestFilterColumns(Object.fromEntries(preview.columns.map(column => [column, {
    type: preview.column_meta[column].type, total: preview.column_meta[column].unique_count, values: [],
  }]))) : [];
  const allColumns = [...new Set([...(preview?.columns || []), ...Object.values(widgetPreviews).flatMap(item => item.columns), ...(filterColumns || [])])];
  const visibleFilterColumns = filterColumns ?? suggestedColumns;
  const visibleLabels = allColumns.map(column => columnLabel(column, columnAliases));
  const aliasConflict = new Set(visibleLabels.map(labelKey)).size !== visibleLabels.length;
  const headers = googleToken ? { 'X-Google-Access-Token': googleToken } : {};
  // The initial empty card follows the reading panel until it is edited or generated.
  const widgetRead = (widget: Widget) => widget.config.sheet || widget.source_id ? chartRead(widget.config) : read;
  const readKey = (id: string, reading: ReadConfig) => JSON.stringify([id, reading]);
  const widgetReadKey = (widget: Widget) => readKey(widget.source_id || sourceId, widgetRead(widget));
  const changingWidget = widgets.find(widget => widget.id === changingSheetFor);
  const widgetConfig = (widget: Widget) => {
    const config = widget.config.sheet ? widget.config : { ...widget.config, ...widgetRead(widget) };
    const columns = widgetPreviews[widgetReadKey(widget)]?.columns;
    const restrictions = Object.entries(filters).flatMap(([column, values]) =>
      values.length && columns?.includes(column) ? [{ column, operator: 'in' as const, value: '', values }] : []);
    return restrictions.length ? { ...config, filter_rules: [...(config.filter_rules || []), ...restrictions] } : config;
  };
  const extraSources = JSON.stringify([...new Set(widgets.flatMap(widget =>
    widget.source_id && widget.source_id !== sourceId ? [widget.source_id] : []))]);
  const previewRequests = JSON.stringify([...new Map(widgets.map(widget => [widgetReadKey(widget), {
    key: widgetReadKey(widget), sourceId: widget.source_id || sourceId, read: widgetRead(widget),
  }])).values()]);
  useEffect(() => {
    const controller = new AbortController();
    setPreviewErrors({});
    if (!sourceReady) {
      setWidgetPreviews({});
      return;
    }
    const entries: { key: string; sourceId: string; read: ReadConfig }[] = JSON.parse(previewRequests);
    const activeKeys = new Set(entries.map(entry => entry.key));
    setWidgetPreviews(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => activeKeys.has(key))));
    for (const entry of entries) {
      if (!entry.sourceId || !entry.read.sheet) continue;
      analytics.post<Preview>(`/v2/sources/${encodeURIComponent(entry.sourceId)}/preview`, entry.read, { headers, signal: controller.signal })
        .then(({ data }) => { if (!controller.signal.aborted) setWidgetPreviews(previous => ({ ...previous, [entry.key]: data })); })
        .catch(e => {
          if (controller.signal.aborted) return;
          setWidgetPreviews(previous => {
            const next = { ...previous };
            delete next[entry.key];
            return next;
          });
          setPreviewErrors(previous => ({ ...previous, [entry.key]: errorMessage(e) }));
        });
    }
    return () => controller.abort();
  }, [previewRequests, sourceReady, googleToken, googleConnectionVersion]);
  const invalidate = () => {
    Object.values(requests.current).forEach(r => r.abort()); requests.current = {};
    setResults({}); setRunning({}); setChartErrors({}); setNotice('');
  };
  const removeMissingFile = (e: unknown) => {
    if (source && source.kind !== 'google' && isAxiosError(e) && e.response?.status === 404) {
      setSources(prev => prev.filter(s => s._id !== sourceId));
      setError('');
      return true;
    }
    return false;
  };
  const reloadLists = async () => {
    const [s, w] = await Promise.all([analytics.get<Source[]>('/v2/sources'), analytics.get<Workspace[]>('/v2/workspaces')]);
    setSources(s.data); setSourcesLoaded(true); setWorkspaces(w.data);
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
    return () => {
      Object.values(requests.current).forEach(r => r.abort());
      sheetChangeRequest.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (sourceMissing) { invalidate(); setPreview(null); setReading(false); setSaveOpen(false); }
  }, [sourceMissing]);
  useEffect(() => {
    if (editId) return;
    setDestination(null); setTargetError('');
    if (!dashboardId && !sectionId) {
      setTargetLoading(false);
      if (loadedEdit.current) {
        loadedEdit.current = ''; setWorkspaceId(''); setPublication(null); setSourceId(''); setRead(initialRead); setFilters({}); setDefaultFilters({}); setFilterColumns(null); setColumnAliases({}); setFilterSorts({}); setFilterOptionRules([]); setWidgets([newWidget()]); setName('Mi tablero'); invalidate();
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
    setPreview(null);
    if (!sourceId || !sourceReady) return;
    const controller = new AbortController();
    analytics.get<string[]>(`/v2/sources/${encodeURIComponent(sourceId)}/sheets`, { headers, signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setSheetsBySource(previous => ({ ...previous, [sourceId]: data }));
        setRead(previous => data.includes(previous.sheet) ? previous : { ...initialRead, sheet: data[0] || '' });
      })
      .catch(e => { if (!controller.signal.aborted && !removeMissingFile(e)) setError(errorMessage(e)); });
    return () => controller.abort();
  }, [sourceId, sourceReady, googleToken, googleConnectionVersion]);
  useEffect(() => {
    const controller = new AbortController();
    for (const id of JSON.parse(extraSources) as string[]) {
      analytics.get<string[]>(`/v2/sources/${encodeURIComponent(id)}/sheets`, { headers, signal: controller.signal })
        .then(({ data }) => {
          if (!controller.signal.aborted) setSheetsBySource(previous => ({ ...previous, [id]: data }));
        })
        .catch(() => {
          if (!controller.signal.aborted) setSheetsBySource(previous => ({ ...previous, [id]: [] }));
        });
    }
    return () => controller.abort();
  }, [extraSources, googleToken, googleConnectionVersion]);
  useEffect(() => {
    setPreview(null);
    setReading(false);
    if (!sourceId || !sourceReady || !sheets?.includes(read.sheet)) return;
    const controller = new AbortController();
    setReading(true); setError('');
    analytics.post<Preview>(`/v2/sources/${encodeURIComponent(sourceId)}/preview`, read, { headers, signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setPreview(data);
        const mapDefaults = mapColumnDefaults(data);
        setWidgets(prev => prev.map(w => {
          if (w.config.sheet || w.source_id) return w;
          const yColumn = data.columns.includes(w.config.y_col) ? w.config.y_col : data.columns.find(c => data.column_meta[c].type === 'number') || data.columns[0];
          const additionalMetrics = [...new Set(w.config.y_cols || [])]
            .filter(column => column !== yColumn && data.columns.includes(column)).slice(0, 19);
          return { ...w, config: { ...w.config,
            x_col: data.columns.includes(w.config.x_col) ? w.config.x_col : data.columns[0],
            y_col: yColumn, y_cols: additionalMetrics,
            latitude_col: data.columns.includes(w.config.latitude_col || '') ? w.config.latitude_col : mapDefaults.latitude,
            longitude_col: data.columns.includes(w.config.longitude_col || '') ? w.config.longitude_col : mapDefaults.longitude,
            label_col: data.columns.includes(w.config.label_col || '') ? w.config.label_col : mapDefaults.label,
            size_col: data.columns.includes(w.config.size_col || '') ? w.config.size_col : '',
            map_metric_cols: [...new Set(w.config.map_metric_cols || [])].filter(column => data.columns.includes(column)).slice(0, 20),
          } };
        }));
      })
      .catch(e => { if (!controller.signal.aborted && !removeMissingFile(e)) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setReading(false); });
    return () => controller.abort();
  }, [sourceId, sourceReady, sheets, read, googleToken, googleConnectionVersion]);
  const selectSource = (id: string) => {
    invalidate(); setPublication(null); setSourceId(id);
    setPreview(null);
    if (!(workspaceId && sourceMissing)) { setRead(initialRead); setFilters({}); setColumnAliases({}); setFilterSorts({}); }
    if (!workspaceId) { setWidgets([newWidget()]); setFilterColumns(null); }
    setError('');
  };
  const changeRead = (patch: Partial<ReadConfig>) => {
    setPreview(null);
    setRead(previous => ({ ...previous, ...patch }));
  };
  const patchWidget = (id: string, patch: Partial<Widget>) => {
    requests.current[id]?.abort();
    setResults(prev => { const next = { ...prev }; delete next[id]; return next; });
    setRunning(prev => ({ ...prev, [id]: false }));
    setChartErrors(prev => { const next = { ...prev }; delete next[id]; return next; });
    setWidgets(prev => prev.map(widget => {
      if (widget.id !== id) return widget;
      const config = patch.config || widget.config;
      return { ...widget, ...patch, config: config.sheet ? config : { ...config, ...widgetRead(widget) } };
    }));
  };
  const closeSheetChange = () => {
    sheetChangeRequest.current?.abort();
    setChangingSheetFor(null);
    setLoadingSheet('');
    setSheetChangeError('');
  };

  const changeWidgetSheet = async (widget: Widget, sheet: string) => {
    const id = widget.source_id || sourceId;
    const previous = widgetRead(widget);
    // Use the destination's reading settings and check that any chart-specific
    // preparation still works with the new sheet before changing the card.
    const destination = id === sourceId && sheet === read.sheet && preview ? read : initialRead;
    const nextRead: ReadConfig = {
      ...previous,
      sheet,
      header_row: destination.header_row,
      decimal: destination.decimal,
      types: destination.types,
    };
    const controller = new AbortController();
    sheetChangeRequest.current?.abort();
    sheetChangeRequest.current = controller;
    setLoadingSheet(sheet);
    setSheetChangeError('');
    try {
      const { data } = await analytics.post<Preview>(`/v2/sources/${encodeURIComponent(id)}/preview`, nextRead, { headers, signal: controller.signal });
      if (controller.signal.aborted) return;
      setWidgetPreviews(current => ({ ...current, [readKey(id, nextRead)]: data }));
      patchWidget(widget.id, { config: { ...widget.config, ...nextRead } });
      closeSheetChange();
    } catch (cause) {
      if (!controller.signal.aborted) setSheetChangeError(errorMessage(cause));
    } finally {
      if (!controller.signal.aborted) setLoadingSheet('');
    }
  };
  const setNumberFormat = (id: string, column: string, format?: NumberPresentation) => {
    setWidgets(current => current.map(widget => {
      if (widget.id !== id) return widget;
      const config = { ...widget.config };
      if (!config.sheet) Object.assign(config, widgetRead(widget));
      const formats = { ...config.number_formats };
      if (format) formats[column] = format;
      else delete formats[column];
      if (Object.keys(formats).length) config.number_formats = formats;
      else delete config.number_formats;
      return { ...widget, config };
    }));
  };
  const generate = async (widget: Widget) => {
    if (!widget.config.sheet) patchWidget(widget.id, { config: { ...widget.config, ...widgetRead(widget) } });
    requests.current[widget.id]?.abort();
    const controller = new AbortController(); requests.current[widget.id] = controller;
    setResults(prev => { const next = { ...prev }; delete next[widget.id]; return next; });
    setRunning(prev => ({ ...prev, [widget.id]: true })); setChartErrors(prev => ({ ...prev, [widget.id]: '' }));
    try {
      const config = { ...widgetConfig(widget) };
      delete config.number_formats;
      const { data } = await analytics.post<ChartData>(`/v2/sources/${encodeURIComponent(widget.source_id || sourceId)}/chart`, config, { headers, signal: controller.signal });
      if (!controller.signal.aborted) setResults(prev => ({ ...prev, [widget.id]: data }));
    } catch (e) {
      if (!controller.signal.aborted && ((widget.source_id && widget.source_id !== sourceId) || !removeMissingFile(e))) {
        setChartErrors(prev => ({ ...prev, [widget.id]: errorMessage(e) }));
      }
    }
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
      if (aliasConflict) throw new Error('Cada columna debe tener un nombre visible diferente.');
      const target = selectedDestination || destination;
      const savedAliases = Object.fromEntries([...new Set([...allColumns, ...Object.keys(columnAliases)])].flatMap(column => {
        const alias = columnAliases[column]?.trim();
        return alias && alias !== column ? [[column, alias]] : [];
      }));
      const savedFilterSorts = filterColumns === null ? filterSorts
        : Object.fromEntries(Object.entries(filterSorts).filter(([column]) => filterColumns.includes(column)));
      const body = { name: savedName, source_id: sourceId, filter_columns: workspaceId ? filterColumns : visibleFilterColumns, column_aliases: savedAliases, filter_sorts: savedFilterSorts, filter_option_rules: filterOptionRules, default_filters: defaultFilters,
        widgets: widgets.map(w => ({ ...w, config: widgetConfig(w) })),
        ...(target ? { destination: { dashboardId: target.dashboardId, sectionId: target.sectionId } } : {}) };
      const { data } = workspaceId ? await analytics.put<Workspace>(`/v2/workspaces/${workspaceId}`, body) : await analytics.post<Workspace>('/v2/workspaces', body);
      contentSaved = true; setWorkspaceId(data._id); setName(savedName); setWidgets(data.widgets); setFilters({});
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
      const cfg = saved.widgets.find(widget => !widget.source_id || widget.source_id === saved.source_id)?.config;
        setRead(cfg ? chartRead(cfg) : initialRead);
        setFilters({}); setDefaultFilters(saved.default_filters || {}); setFilterColumns(saved.filter_columns ?? null); setColumnAliases(saved.column_aliases || {}); setFilterSorts(saved.filter_sorts || {}); setFilterOptionRules(saved.filter_option_rules || []); setNotice('Estás editando gráficos guardados.');
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
        <label>Archivos disponibles<select value={sourceReady ? sourceId : ''} onChange={e => selectSource(e.target.value)} disabled={busy || !sourcesLoaded}><option value="">Elegir fuente</option>{sources.map(s => <option key={s._id} value={s._id}>{s.name} ({s.kind === 'system' ? 'sistema' : s.kind === 'google' ? 'Google Sheets' : 'propio'})</option>)}</select></label>
      </div>
      <p className="generator-hint">La lista incluye archivos disponibles en este servidor y tus hojas de Google Sheets. Si falta un archivo, podés volver a subirlo.</p>
      {sourcesLoaded && sources.length === 0 && <p role="status">Todavía no hay fuentes disponibles. Subí un archivo o vinculá una hoja de Google Sheets.</p>}
      {sourceMissing && <p role="alert" className="generator-error">{workspaceId ? 'La fuente de este tablero no está disponible. Conservamos la configuración de tus gráficos.' : 'El archivo seleccionado ya no está disponible.'} Volvé a subir el archivo o elegí otra fuente para continuar.</p>}
      <label className="generator-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) upload(e.dataTransfer.files[0]); }}>
        Subir archivo o arrastrarlo aquí · XLSX, XLSM, XLS, CSV, TSV · hasta 25 MB
        <input aria-label="Subir archivo" type="file" accept=".xlsx,.xlsm,.xls,.csv,.tsv" disabled={busy} onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      <GoogleConnectionPanel token={googleToken} onToken={token => { invalidate(); setGoogleToken(token); }} onConnectionChange={() => { invalidate(); setGoogleConnectionVersion(v => v + 1); }} busy={busy} onUseSheet={linkGoogle} />
      {busy && <p role="status">Procesando…</p>}
    </section>
    {sourceReady && <section className="generator-panel"><h2>2. Revisar la lectura · {source?.name}</h2>
      <div className="generator-controls">
        <label>Hoja<select value={read.sheet} onChange={e => changeRead({ sheet: e.target.value, types: {}, computed_columns: undefined, aggregate_join: undefined, google_summary: undefined })}><option value="">Elegir hoja</option>{sheets?.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Fila de encabezados (0 = sin encabezados)<input type="number" min={0} max={100000} value={read.header_row} onChange={e => changeRead({ header_row: Math.max(0, Number(e.target.value)), types: {} })} /></label>
        <label>Formato de números<select value={read.decimal} onChange={e => changeRead({ decimal: e.target.value })}><option value=",">1.234,56</option><option value=".">1,234.56</option></select></label>
        <button onClick={() => { invalidate(); setRead(prev => ({ ...prev })); }}>Actualizar datos</button>
      </div>
      {reading && <p role="status">Leyendo datos…</p>}
      {preview && <>
        <p>{preview.row_count.toLocaleString('es-AR')} filas · {preview.columns.length} columnas. Vista previa: primeras 20 filas.</p>
        {preview.warnings.map((w, i) => <p className="generator-hint" key={i}>{w}</p>)}
        <details><summary>Ver primeras filas originales (para ubicar los encabezados)</summary><div className="generator-table"><table><tbody>{preview.raw_preview.map((r, i) => <tr key={i}><th>{i + 1}</th>{r.map((v, j) => <td key={j}>{String(v ?? '')}</td>)}</tr>)}</tbody></table></div></details>
        <p className="generator-hint">Los nombres visibles solo cambian este tablero; la hoja y sus encabezados originales no se modifican.</p>
        {aliasConflict && <p role="alert" className="generator-error">Cada columna debe tener un nombre visible diferente.</p>}
        <div className="generator-table"><table><thead><tr>{preview.columns.map(c => <th key={c}>
          <input aria-label={`Nombre visible de ${c}`} value={columnAliases[c] ?? c} maxLength={200}
            onChange={event => setColumnAliases(previous => ({ ...previous, [c]: event.target.value }))} />
          <span className="generator-column-source">Origen: {c}</span>
          <select aria-label={`Tipo de ${c}`} value={read.types[c] || 'auto'} onChange={e => changeRead({ types: { ...read.types, [c]: e.target.value } })}><option value="auto">Detectar ({preview.column_meta[c].type})</option><option value="text">Texto</option><option value="number">Número / porcentaje</option><option value="date">Fecha</option><option value="boolean">Sí / No</option></select>
        </th>)}</tr></thead><tbody>{preview.preview.map((r, i) => <tr key={i}>{preview.columns.map(c => <td key={c}>{String(r[c] ?? '—')}</td>)}</tr>)}</tbody></table></div>
      </>}
    </section>}
    {sourceReady && (preview || workspaceId) && <>
      <section className="generator-panel"><h2>3. Filtros de la sección</h2>
        <p className="generator-hint">Elegí los campos que aparecerán arriba de la sección. Por ejemplo, Año y Mes: una selección actualizará todos los gráficos que tengan esos campos, incluidos los totales.</p>
        <Autocomplete className="filter-field-picker" multiple disableCloseOnSelect size="small" options={allColumns} value={visibleFilterColumns}
          getOptionLabel={column => columnLabel(column, columnAliases)}
          getOptionDisabled={column => visibleFilterColumns.length >= 20 && !visibleFilterColumns.includes(column)}
          onChange={(_, columns) => setFilterColumns(columns)}
          renderOption={(props, column, { selected }) => { const { key, ...other } = props; return <li key={key} {...other}><Checkbox size="small" checked={selected} sx={{ mr: 1 }} />{columnLabel(column, columnAliases)}</li>; }}
          renderInput={params => <TextField {...params} label="Campos para filtrar la sección" placeholder="Elegir campos" helperText="Hasta 20 campos. Si no elegís ninguno, la sección se mostrará sin filtros." />} />
        <Button size="small" onClick={() => setFilterColumns(suggestedColumns)}>Sugerir filtros</Button>
        <Button size="small" onClick={() => setFilterColumns([])}>Quitar todos</Button>
        {!!visibleFilterColumns.length && <details className="generator-restrictions" open><summary>Orden de los valores de los filtros</summary>
          <p className="generator-hint">Cada filtro puede ordenarse usando cualquier campo de los datos y la operación elegida.</p>
          <div className="generator-filter-sorts">{visibleFilterColumns.map(column => <SortControls key={column}
            title={`Orden de ${columnLabel(column, columnAliases)}`} columns={allColumns} aliases={columnAliases}
            value={filterSorts[column]} fallbackField={column}
            onChange={sort => setFilterSorts(previous => {
              const next = { ...previous };
              if (sort) next[column] = sort;
              else delete next[column];
              return next;
            })} />)}</div>
        </details>}
        <details className="generator-restrictions"><summary>Limitar los datos guardados{Object.values(filters).some(v => v.length) ? ' · Hay restricciones activas' : ' (opcional)'}</summary>
        <p className="generator-hint">Estas restricciones definen qué datos tendrá la sección. Los filtros de arriba solo permiten explorar dentro de este conjunto. Sin selección se incluyen todos los valores.</p><div className="generator-controls">
         {allColumns.map(c => <label key={c}>{columnLabel(c, columnAliases)}<input placeholder="Valores separados por ;" value={(filters[c] || []).join(';')} onChange={e => { invalidate(); setFilters(prev => ({ ...prev, [c]: e.target.value ? e.target.value.split(';') : [] })); }} list={`values-${encodeURIComponent(c)}`} /><datalist id={`values-${encodeURIComponent(c)}`}>{(preview?.column_meta[c]?.unique_values || []).map((v, i) => <option key={i} value={String(v)} />)}</datalist></label>)}
        <button onClick={() => { invalidate(); setFilters({}); }}>Limpiar filtros</button>
      </div></details></section>
      <section className="generator-controls generator-panel">
        {destination ? <strong>{destination.dashboardName} → {destination.sectionName}</strong> : <label>Nombre del tablero<input value={name} maxLength={200} onChange={e => setName(e.target.value)} /></label>}
        <button disabled={busy || targetLoading || !!targetError || !name.trim() || !widgets.length || aliasConflict || widgets.some(widget => !widgetPreviews[widgetReadKey(widget)])} className="generator-primary" onClick={() => { setSaveError(''); setSaveOpen(true); }}>{destination ? 'Guardar en esta sección' : 'Guardar tablero'}</button>
        <button disabled={busy} onClick={() => { setWorkspaceId(''); setPublication(null); setDestination(null); setTargetError(''); setSearchParams({}, { replace: true }); loadedEdit.current = ''; setName(name + ' (copia)'); setNotice('Se guardará una copia. Al guardar podés elegir otra sección vacía o crear un tablero nuevo.'); }}>Guardar como nuevo</button>
        <button disabled={widgets.length >= 30 || !preview} onClick={() => {
          if (!preview) return;
          const widget = newWidget(read), mapDefaults = mapColumnDefaults(preview);
          widget.config = { ...widget.config, x_col: preview.columns[0], y_col: preview.columns.find(c => preview.column_meta[c].type === 'number') || preview.columns[0], y_cols: [],
            latitude_col: mapDefaults.latitude, longitude_col: mapDefaults.longitude, label_col: mapDefaults.label };
          setWidgets(previous => [...previous, widget]);
        }}>Agregar gráfico</button>
        {read.sheet && <span className="generator-hint">Hoja para el próximo gráfico: {read.sheet}</span>}
      </section>
      <div className="generator-grid">{widgets.map((w, index) => {
        const key = widgetReadKey(w);
        const preview = widgetPreviews[key];
        const chartColumns = [...new Set([...(preview?.columns || []), ...Object.keys(w.config.calculated_fields || {})])];
        const widgetSource = w.source_id || sourceId;
        const sheet = widgetRead(w).sheet;
        const sheets = sheetsBySource[widgetSource] || [];
        const canChangeSheet = sheets.some(name => name !== sheet) || (!!previewErrors[key] && sheets.includes(sheet));
        const canGroupOther = ['sum', 'count'].includes(w.config.aggregation) ||
          (w.config.aggregation === 'distinct' && !w.config.group_col && !w.config.y_cols?.length);
        return <section key={w.id} className="generator-panel generator-widget" style={{ gridColumn: `span ${w.width}` }}>
        <div className="generator-controls">
          <p className="generator-hint">Fuente: {sources.find(item => item._id === widgetSource)?.name || 'Fuente guardada'} · {sheet}</p>
          {canChangeSheet && <button type="button" disabled={busy} onClick={() => setChangingSheetFor(w.id)}>Cambiar hoja</button>}
        </div>
        <div className="generator-controls"><label>Título<input value={w.title} onChange={e => patchWidget(w.id, { title: e.target.value })} /></label><label>Ancho<select disabled={w.config.chart_type === 'indicator'} value={w.config.chart_type === 'indicator' ? 'compact' : w.width} onChange={e => patchWidget(w.id, { width: Number(e.target.value) })}>{w.config.chart_type === 'indicator' ? <option value="compact">Compacto (automático)</option> : <><option value={12}>Completo</option><option value={6}>Mitad</option></>}</select></label><button disabled={index === 0} onClick={() => move(index, -1)}>Subir</button><button disabled={index === widgets.length - 1} onClick={() => move(index, 1)}>Bajar</button><button onClick={() => { requests.current[w.id]?.abort(); setWidgets(prev => prev.filter(item => item.id !== w.id)); }}>Quitar</button></div>
        {!preview ? (previewErrors[key] ? <p role="alert" className="generator-error">{previewErrors[key]}</p>
          : <p role="status">{sheet ? 'Leyendo la hoja de este gráfico…' : 'Elegí una hoja para este gráfico.'}</p>) : <>
        {w.config.chart_type === 'indicator' && <p className="generator-hint">En la sección, los contadores se agrupan en tarjetas compactas debajo de los filtros.</p>}
        <div className="generator-controls">
          <label>Tipo de gráfico<select value={w.config.chart_type} onChange={e => patchWidget(w.id, { config: { ...w.config, chart_type: e.target.value as ChartType } })}>{Object.entries(chartNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {w.config.chart_type === 'map'
            ? <label>Presentación<select value="Google Maps" disabled><option>Google Maps</option></select></label>
            : <label>Presentación<select value={w.library} onChange={e => patchWidget(w.id, { library: e.target.value as Widget['library'] })}><option>Plotly</option><option>ECharts</option></select></label>}
          {w.config.chart_type === 'map' && w.config.map_lookup ? <>
            <p className="generator-hint">Ubicaciones verificadas por {columnLabel(w.config.map_lookup.column, columnAliases)}. Los filtros se aplican antes de calcular cada punto.</p>
            <label>Valor del mapa<select disabled={w.config.aggregation === 'count'} value={w.config.y_col || ''} onChange={e => patchWidget(w.id, { config: { ...w.config, y_col: e.target.value } })}>
              {w.config.aggregation === 'count' ? <option value="">Cantidad de registros</option> : preview.columns.map(c => <option key={c} value={c}>{columnLabel(c, columnAliases)}</option>)}
            </select></label>
          </> : w.config.chart_type === 'map' ? <>
            <label>Latitud<select value={w.config.latitude_col || ''} onChange={e => patchWidget(w.id, { config: { ...w.config, latitude_col: e.target.value } })}>{preview.columns.map(c => <option key={c} value={c}>{columnLabel(c, columnAliases)}</option>)}</select></label>
            <label>Longitud<select value={w.config.longitude_col || ''} onChange={e => patchWidget(w.id, { config: { ...w.config, longitude_col: e.target.value } })}>{preview.columns.map(c => <option key={c} value={c}>{columnLabel(c, columnAliases)}</option>)}</select></label>
            <label>Nombre del punto<select value={w.config.label_col || ''} onChange={e => patchWidget(w.id, { config: { ...w.config, label_col: e.target.value } })}><option value="">Nombre automático</option>{preview.columns.map(c => <option key={c} value={c}>{columnLabel(c, columnAliases)}</option>)}</select></label>
            <label>Representación<select value={w.config.map_mode || 'markers'} onChange={e => patchWidget(w.id, { config: { ...w.config, map_mode: e.target.value as 'markers' | 'circles' } })}><option value="markers">Puntos</option><option value="circles">Círculos</option></select></label>
            {w.config.map_mode === 'circles' && <label>Tamaño de los círculos<select value={w.config.size_col || ''} onChange={e => patchWidget(w.id, { config: { ...w.config, size_col: e.target.value } })}><option value="">Tamaño uniforme</option>{preview.columns.filter(c => preview.column_meta[c].type === 'number').map(c => <option key={c} value={c}>{columnLabel(c, columnAliases)}</option>)}</select></label>}
            {(w.config.map_metric_cols || []).map((metric, metricIndex) => <div className="generator-metric-control" key={`${metricIndex}-${metric}`}>
              <label>Métrica del mapa {metricIndex + 1}<select aria-label={`Métrica del mapa ${metricIndex + 1}`} value={metric} onChange={event => {
                const next = [...(w.config.map_metric_cols || [])]; next[metricIndex] = event.target.value;
                patchWidget(w.id, { config: { ...w.config, map_metric_cols: [...new Set(next)] } });
              }}>{preview.columns.map(column => <option key={column} value={column}
                disabled={column !== metric && (w.config.map_metric_cols || []).includes(column)}>{columnLabel(column, columnAliases)}</option>)}</select></label>
              <button type="button" className="generator-metric-remove" aria-label={`Quitar métrica del mapa ${metricIndex + 1}`} title="Quitar métrica"
                onClick={() => patchWidget(w.id, { config: { ...w.config, map_metric_cols: (w.config.map_metric_cols || []).filter((_, index) => index !== metricIndex) } })}>
                <Icon icon="material-symbols:close-rounded" width={20} />
              </button>
            </div>)}
            <button type="button" className="generator-add-metric" aria-label="Agregar otra métrica" title="Agregar un dato al detalle de cada punto"
              disabled={(w.config.map_metric_cols || []).length >= Math.min(20, preview.columns.length)} onClick={() => {
                const selected = new Set(w.config.map_metric_cols || []);
                const reserved = new Set([w.config.latitude_col, w.config.longitude_col, w.config.label_col].filter(Boolean));
                const next = preview.columns.find(column => !selected.has(column) && !reserved.has(column)) || preview.columns.find(column => !selected.has(column));
                if (next) patchWidget(w.id, { config: { ...w.config, map_metric_cols: [...selected, next] } });
              }}><Icon icon="material-symbols:add-rounded" width={20} /> Agregar métrica</button>
          </> : <>
            <label>Eje X / categoría<select value={w.config.x_col} onChange={e => patchWidget(w.id, { config: { ...w.config, x_col: e.target.value } })}>{chartColumns.map(c => <option key={c} value={c}>{columnLabel(c, columnAliases)}</option>)}</select></label>
            <label>Valor / eje Y<select value={w.config.y_col} onChange={e => patchWidget(w.id, { config: { ...w.config, y_col: e.target.value, y_cols: (w.config.y_cols || []).filter(column => column !== e.target.value) } })}>{chartColumns.map(c => <option key={c} value={c}>{columnLabel(c, columnAliases)}</option>)}</select></label>
            {supportsAdditionalMetrics(w.config) && (w.config.y_cols || []).map((metric, metricIndex) => <div className="generator-metric-control" key={`${metricIndex}-${metric}`}>
              <label>Métrica adicional {metricIndex + 1}<select aria-label={`Métrica adicional ${metricIndex + 1}`} value={metric} onChange={event => {
                const next = [...(w.config.y_cols || [])]; next[metricIndex] = event.target.value;
                patchWidget(w.id, { config: { ...w.config, y_cols: [...new Set(next)] } });
              }}>{chartColumns.map(column => <option key={column} value={column}
                disabled={column !== metric && metricColumns(w.config).includes(column)}>{columnLabel(column, columnAliases)}</option>)}</select></label>
              <button type="button" className="generator-metric-remove" aria-label={`Quitar métrica adicional ${metricIndex + 1}`} title="Quitar métrica"
                onClick={() => patchWidget(w.id, { config: { ...w.config, y_cols: (w.config.y_cols || []).filter((_, index) => index !== metricIndex) } })}>
                <Icon icon="material-symbols:close-rounded" width={20} />
              </button>
            </div>)}
            <button type="button" className="generator-add-metric" aria-label="Agregar otra métrica"
              title={supportsAdditionalMetrics(w.config) ? 'Agregar otra métrica' : 'Este gráfico u operación admite una sola métrica'}
              disabled={!supportsAdditionalMetrics(w.config) || metricColumns(w.config).length >= Math.min(20, chartColumns.length)}
              onClick={() => {
                const next = chartColumns.find(column => !metricColumns(w.config).includes(column));
                if (next) patchWidget(w.id, { config: { ...w.config, y_cols: [...(w.config.y_cols || []), next] } });
              }}><Icon icon="material-symbols:add-rounded" width={20} /> Agregar métrica</button>
            {['pie', 'donut'].includes(w.config.chart_type) && <label>Valor dentro de cada porción<select value={w.config.pie_label_mode || 'percent'}
              onChange={e => patchWidget(w.id, { config: { ...w.config, pie_label_mode: e.target.value as PieLabelMode } })}>
              <option value="percent">Porcentaje del total</option><option value="value">Valor nominal</option>
            </select></label>}
            {w.config.chart_type === 'table' && <label>Contenido de la tabla<select value={w.config.table_mode || 'rows'} onChange={e => patchWidget(w.id, { config: { ...w.config, table_mode: e.target.value as 'rows' | 'summary' } })}><option value="rows">Filas originales</option><option value="summary">Resumen por categoría</option></select></label>}
            <label>Operación<select disabled={['scatter', 'box', 'histogram'].includes(w.config.chart_type) || (w.config.chart_type === 'table' && w.config.table_mode !== 'summary')} value={w.config.aggregation} onChange={e => patchWidget(w.id, { config: { ...w.config, aggregation: e.target.value } })}>{Object.entries(operations).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Separar series<select value={w.config.group_col} onChange={e => patchWidget(w.id, { config: { ...w.config, group_col: e.target.value } })}><option value="">Sin separar</option>{preview.columns.map(c => <option key={c} value={c}>{columnLabel(c, columnAliases)}</option>)}</select></label>
            <label>Agrupar fechas<select value={w.config.date_bucket} onChange={e => patchWidget(w.id, { config: { ...w.config, date_bucket: e.target.value } })}><option value="none">Sin agrupar</option><option value="month">Por mes</option><option value="year">Por año</option></select></label>
          </>}
          <button className="generator-primary" disabled={busy || running[w.id]} onClick={() => generate(w)}>{running[w.id] ? 'Generando…' : 'Generar gráfico'}</button>
        </div>
        <ChartNumberSettings config={w.config} columns={preview.columns} aliases={columnAliases}
          onChange={(column, format) => setNumberFormat(w.id, column, format)} />
        {sortableCharts.has(w.config.chart_type) && <details className="generator-restrictions"><summary>Orden del gráfico</summary>
          <label>Cantidad máxima de categorías<input type="number" min={2} max={500} placeholder="Todas" value={w.config.category_limit ?? ''} onChange={e => patchWidget(w.id, { config: { ...w.config, category_limit: e.target.value ? Number(e.target.value) : null } })} /></label>
          <label><input type="checkbox" checked={!!w.config.include_other} disabled={!w.config.category_limit || !canGroupOther} onChange={e => patchWidget(w.id, { config: { ...w.config, include_other: e.target.checked } })} />Agrupar el resto como Otros</label>
          <SortControls title="Orden de categorías" columns={chartColumns} aliases={columnAliases} value={w.config.category_sort}
            fallbackField={w.config.x_col} onChange={sort => patchWidget(w.id, { config: { ...w.config, category_sort: sort } })} />
          {!!w.config.group_col && <SortControls title="Orden de series" columns={chartColumns} aliases={columnAliases} value={w.config.series_sort}
            fallbackField={w.config.group_col} onChange={sort => patchWidget(w.id, { config: { ...w.config, series_sort: sort } })} />}
          {!!w.config.group_col && seriesLimitCharts.has(w.config.chart_type) &&
            <label>Cantidad máxima de series<input type="number" min={1} max={50} step={1} placeholder="Automático"
              value={w.config.series_limit ?? ''} onChange={event => {
                const input = event.target;
                if (input.validity.valid) patchWidget(w.id, { config: { ...w.config, series_limit: input.value ? input.valueAsNumber : undefined } });
              }} /></label>}
        </details>}
        <details className="generator-restrictions"><summary>Restricciones de este gráfico{Object.keys(w.config.filters || {}).length + (w.config.filter_rules?.length || 0) > 0 ? ' · Activas' : ' (opcional)'}</summary>
          <p className="generator-hint">Se aplican antes de los filtros de la sección y solo afectan a este gráfico. Pestaña: {w.config.sheet || read.sheet}.</p>
          {Object.entries(w.config.filters || {}).map(([column, values]) => <label key={column}>{columnLabel(column, columnAliases)}<input value={values.join(';')} onChange={e => patchWidget(w.id, { config: { ...w.config, filters: { ...w.config.filters, [column]: e.target.value ? e.target.value.split(';') : [] } } })} /></label>)}
          {(w.config.filter_rules || []).map((rule, index) => <div className="generator-controls" key={index}>
            <label>Campo<select value={rule.column} onChange={e => patchWidget(w.id, { config: { ...w.config, filter_rules: w.config.filter_rules!.map((r, i) => i === index ? { ...r, column: e.target.value } : r) } })}>{[...new Set([rule.column, ...preview.columns])].filter(Boolean).map(c => <option key={c} value={c}>{columnLabel(c, columnAliases)}</option>)}</select></label>
            <label>Condición<select value={rule.operator} onChange={e => patchWidget(w.id, { config: { ...w.config, filter_rules: w.config.filter_rules!.map((r, i) => i === index ? { ...r, operator: e.target.value as typeof rule.operator } : r) } })}>{Object.entries({ equal: 'Igual a', not_equal: 'Distinto de', contains: 'Contiene', not_contains: 'No contiene', empty: 'Está vacío', not_empty: 'No está vacío', in: 'Es uno de', greater_equal: 'Mayor o igual que' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {!['empty', 'not_empty'].includes(rule.operator) && <label>Valor<input value={rule.operator === 'in' ? (rule.values || []).join(';') : rule.value} onChange={e => patchWidget(w.id, { config: { ...w.config, filter_rules: w.config.filter_rules!.map((r, i) => i === index ? { ...r, ...(rule.operator === 'in' ? { values: e.target.value.split(';') } : { value: e.target.value }) } : r) } })} /></label>}
            <button type="button" onClick={() => patchWidget(w.id, { config: { ...w.config, filter_rules: w.config.filter_rules!.filter((_, i) => i !== index) } })}>Quitar condición</button>
          </div>)}
          <button type="button" onClick={() => patchWidget(w.id, { config: { ...w.config, filter_rules: [...(w.config.filter_rules || []), { column: preview.columns[0], operator: 'equal', value: '' }] } })}>Agregar condición</button>
        </details>
        {chartErrors[w.id] && <p role="alert" className="generator-error">{chartErrors[w.id]}</p>}
        {results[w.id] && <><h3>{w.title}</h3><p className="generator-hint">{results[w.id].filtered_rows} registros · {w.config.chart_type === 'map' ? 'Mapa' : operations[w.config.aggregation]}{['box', 'scatter', 'histogram'].includes(w.config.chart_type) ? ' (este tipo usa los valores individuales)' : ''}</p>{results[w.id].warnings.map((v, i) => <p className="generator-hint" key={i}>{v}</p>)}<GeneratorChart widget={w} result={results[w.id]} aliases={columnAliases} /></>}
        </>}
      </section>; })}</div>
    </>}
    <Dialog open={!!changingWidget} onClose={closeSheetChange} aria-labelledby="change-chart-sheet-title" fullWidth maxWidth="xs">
      <DialogTitle id="change-chart-sheet-title">Cambiar hoja</DialogTitle>
      {changingWidget && <DialogContent>
        <p>Hoja actual de {changingWidget.title}: <strong>{widgetRead(changingWidget).sheet}</strong></p>
        {sheetChangeError && <Alert severity="error">{sheetChangeError}</Alert>}
        {loadingSheet && <p role="status">Leyendo {loadingSheet}…</p>}
        <List disablePadding aria-label="Hojas disponibles">
          {(sheetsBySource[changingWidget.source_id || sourceId] || []).map(sheet => {
            const isCurrent = sheet === widgetRead(changingWidget).sheet;
            return <ListItemButton key={sheet} component="button" type="button" sx={{ width: '100%' }}
              disabled={!!loadingSheet || (isCurrent && !previewErrors[widgetReadKey(changingWidget)])}
              onClick={() => void changeWidgetSheet(changingWidget, sheet)}>
              <ListItemText primary={sheet} secondary={isCurrent ? 'Hoja actual' : undefined} />
            </ListItemButton>;
          })}
        </List>
      </DialogContent>}
      <DialogActions><Button onClick={closeSheetChange}>Cancelar</Button></DialogActions>
    </Dialog>
    <SaveDashboardDialog open={saveOpen} workspaceId={workspaceId} name={name} destination={destination} busy={busy} error={saveError} count={widgets.length} onClose={() => setSaveOpen(false)} onSave={save} />
  </main>;
}
