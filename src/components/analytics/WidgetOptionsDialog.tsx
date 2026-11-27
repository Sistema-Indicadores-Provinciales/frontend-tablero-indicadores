import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { analytics, errorMessage } from 'config/Analytics';
import type { ChartConfig, Preview, Source, Widget } from 'types/Generator';
import { readSettings } from 'utils/editorDraft';
import { FormatControl } from './CalculationDialog';

const preparationNames: Partial<Record<keyof ChartConfig, string>> = {
  computed_columns: 'Columnas de texto preparadas', aggregate_join: 'Combinación de hojas', google_summary: 'Resumen de Google',
  indicator_rules: 'Reglas originales de conteo', indicator_sum_rules: 'Reglas originales de suma',
  indicator_lookup: 'Asignación original por categoría', metric_condition: 'Condición original de la métrica', metric_ratio: 'Cociente original de métricas',
  table_sorts: 'Ordenamientos de tabla', map_lookup: 'Ubicaciones verificadas',
};

export default function WidgetOptionsDialog({ open, widget, sourceId, sources, columns, headers, onClose, onApply }: {
  open: boolean; widget: Widget; sourceId: string; sources: Source[]; columns: string[]; headers: Record<string, string>;
  onClose: () => void; onApply: (widget: Widget) => void;
}) {
  const [draft, setDraft] = useState(widget), [sheets, setSheets] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [preparation, setPreparation] = useState<Record<string, string>>({});
  const [activeFormat, setActiveFormat] = useState('');
  useEffect(() => {
    if (!open) return;
    setDraft(structuredClone(widget)); setError(''); setPreview(null); setActiveFormat(widget.config.y_col || columns[0] || '');
    setPreparation(Object.fromEntries(Object.keys(preparationNames).map(key => [key, JSON.stringify(widget.config[key as keyof ChartConfig] ?? null, null, 2)])));
  }, [open]);
  const identifier = draft.source_id || sourceId;
  const reading = JSON.stringify(readSettings(draft.config));
  useEffect(() => {
    if (!open || !identifier) return;
    const controller = new AbortController();
    setSheets([]);
    analytics.get<string[]>(`/v2/sources/${encodeURIComponent(identifier)}/sheets`, { headers, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setSheets(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
    return () => controller.abort();
  }, [open, identifier]);
  useEffect(() => {
    if (!open || !identifier || !draft.config.sheet) return;
    const controller = new AbortController();
    setPreview(null); setLoading(true); setError('');
    const timer = window.setTimeout(() => {
      analytics.post<Preview>(`/v2/sources/${encodeURIComponent(identifier)}/preview`, JSON.parse(reading), { headers, signal: controller.signal })
        .then(({ data }) => { if (!controller.signal.aborted) setPreview(data); })
        .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, identifier, reading]);
  const sameReading = identifier === (widget.source_id || sourceId) && reading === JSON.stringify(readSettings(widget.config));
  const available = preview?.columns || (sameReading ? columns : []);
  const metrics = [...new Set([...available, ...(draft.config.calculated_fields || []).map(field => field.name), 'Registros'])];
  const patch = (change: Partial<ChartConfig>) => setDraft(previous => ({ ...previous, config: { ...previous.config, ...change } }));
  const apply = () => {
    try {
      const next = { ...draft, config: { ...draft.config } };
      for (const key of Object.keys(preparationNames) as (keyof ChartConfig)[]) {
        const original = JSON.stringify(widget.config[key] ?? null, null, 2);
        if (preparation[key] !== original) {
          const value = JSON.parse(preparation[key]);
          if (value === null) delete next.config[key];
          else Object.assign(next.config, { [key]: value });
        }
      }
      onApply(next); onClose();
    } catch { setError('Una de las configuraciones avanzadas no contiene JSON válido. Conservamos el borrador.'); }
  };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="widget-options-title">
    <DialogTitle id="widget-options-title">Opciones del gráfico · {widget.title}</DialogTitle>
    <DialogContent><div className="generator generator-lab">{error && <Alert severity="error">{error}</Alert>}
      <fieldset><legend>Fuente y hoja de este gráfico</legend><div className="generator-controls">
        <label>Fuente del gráfico<select value={identifier} onChange={event => setDraft({ ...draft, source_id: event.target.value })}>{[...new Set([identifier, ...sources.map(source => source._id)])].map(id => <option key={id} value={id}>{sources.find(source => source._id === id)?.name || id}</option>)}</select></label>
        <label>Hoja del gráfico<select value={draft.config.sheet} onChange={event => patch({ sheet: event.target.value })}>{[...new Set([draft.config.sheet, ...sheets])].filter(Boolean).map(sheet => <option key={sheet}>{sheet}</option>)}</select></label>
        <label>Encabezado del gráfico<input type="number" min={0} max={100000} value={draft.config.header_row ?? 1} onChange={event => patch({ header_row: Number(event.target.value) })} /></label>
        <label>Separador decimal<select value={draft.config.decimal || ','} onChange={event => patch({ decimal: event.target.value })}><option value=",">Coma</option><option value=".">Punto</option></select></label>
      </div>
      {loading && <p role="status">Leyendo la configuración actual…</p>}
      {preview && <><p role="status">{preview.row_count} registros · Hoja {draft.config.sheet} · Muestra de {preview.preview.length} filas.</p><div className="generator-table"><table><thead><tr>{preview.columns.map(column => <th key={column}>{column}<select aria-label={`Tipo del gráfico: ${column}`} value={draft.config.types?.[column] || 'auto'} onChange={event => patch({ types: { ...draft.config.types, [column]: event.target.value } })}><option value="auto">Detectar</option><option value="number">Número</option><option value="text">Texto</option><option value="date">Fecha</option><option value="boolean">Sí/No</option></select></th>)}</tr></thead><tbody>{preview.preview.slice(0, 5).map((row, index) => <tr key={index}>{preview.columns.map(column => <td key={column}>{String(row[column] ?? '—')}</td>)}</tr>)}</tbody></table></div></>}
      </fieldset>
      <fieldset><legend>Formato por métrica o columna</legend><label>Columna para dar formato<select value={activeFormat} onChange={event => setActiveFormat(event.target.value)}>{metrics.map(metric => <option key={metric}>{metric}</option>)}</select></label>
        <FormatControl value={draft.config.numeric_formats?.[activeFormat]} onChange={format => patch({ numeric_formats: { ...draft.config.numeric_formats, [activeFormat]: format } })} />
      </fieldset>
      {draft.config.chart_type === 'table' && (draft.config.table_mode || 'rows') === 'rows' && <fieldset><legend>Columnas y filas de tabla</legend><div className="generator-controls">{metrics.filter(metric => metric !== 'Registros').map(column => <label key={column} className="generator-check"><input type="checkbox" checked={(draft.config.table_columns || available).includes(column)} onChange={event => patch({ table_columns: event.target.checked ? [...(draft.config.table_columns || available), column] : (draft.config.table_columns || available).filter(value => value !== column) })} />{column}</label>)}</div>
        <label className="generator-check"><input type="checkbox" checked={!!draft.config.table_unique} onChange={event => patch({ table_unique: event.target.checked })} />Mostrar combinaciones únicas de las columnas visibles</label>
        <p className="generator-hint">Se filtran los datos antes de obtener las combinaciones únicas y paginar.</p>
      </fieldset>}
      {draft.config.chart_type === 'table' && draft.config.table_mode === 'summary' && <fieldset><legend>Dimensiones de la tabla de resumen</legend><div className="generator-controls">{metrics.filter(column => column !== 'Registros' && !draft.config.calculated_fields?.some(field => field.name === column && field.mode === 'aggregate')).map(column => {
        const dimensions = draft.config.table_dimensions || [draft.config.x_col, draft.config.group_col].filter(Boolean);
        return <label key={column} className="generator-check"><input type="checkbox" checked={dimensions.includes(column)} onChange={event => patch({ table_dimensions: event.target.checked ? [...dimensions, column] : dimensions.filter(value => value !== column) })} />{column}</label>;
      })}</div></fieldset>}
      {['bar', 'horizontal', 'stacked'].includes(draft.config.chart_type) && <label>Etiquetas de barras<select value={draft.config.bar_labels || 'none'} onChange={event => patch({ bar_labels: event.target.value as ChartConfig['bar_labels'] })}><option value="none">Sin etiquetas</option><option value="value">Valor de cada métrica</option><option value="second_metric">Etiqueta de la segunda métrica</option>{draft.config.chart_type === 'stacked' && <option value="percent_stack">Barras al 100 % con porcentajes</option>}</select></label>}
      <fieldset><legend>Mecanismos originales de indicadores</legend><p className="generator-hint">Estas opciones editan la configuración existente. Se conservan al cambiar el título o trabajar con otro gráfico.</p>
        <div className="generator-controls"><label>Columna para contar valores no vacíos<select value={draft.config.count_col || ''} onChange={event => patch({ count_col: event.target.value })}><option value="">Contar todos los registros</option>{available.map(column => <option key={column}>{column}</option>)}</select></label>
        <label>Columna de texto publicado<select value={draft.config.indicator_text_column || ''} onChange={event => patch({ indicator_text_column: event.target.value })}><option value="">Ninguna</option>{available.map(column => <option key={column}>{column}</option>)}</select></label>
        <label>Dividir indicador por<input type="number" min={0.000001} value={draft.config.indicator_divisor ?? 1} onChange={event => patch({ indicator_divisor: Number(event.target.value) })} /></label>
        <label>Decimales del indicador<input type="number" min={0} max={6} value={draft.config.indicator_decimals ?? ''} onChange={event => patch({ indicator_decimals: event.target.value ? Number(event.target.value) : null })} /></label>
        <label>Sufijo del indicador<input value={draft.config.indicator_suffix || ''} onChange={event => patch({ indicator_suffix: event.target.value })} /></label>
        <label>Porcentaje original<select value={draft.config.value_format || 'number'} onChange={event => patch({ value_format: event.target.value as ChartConfig['value_format'] })}><option value="number">Número</option><option value="percent">Proporción</option><option value="percent_points">Valor ya multiplicado por 100</option></select></label>
        </div>
        <label className="generator-check"><input type="checkbox" checked={!!draft.config.indicator_condition} onChange={event => patch({ indicator_condition: event.target.checked ? { column: available[0] || '', minimum: 0 } : null })} />Condición original del contador</label>
        {draft.config.indicator_condition && <div className="generator-controls"><label>Columna de condición original<select value={draft.config.indicator_condition.column} onChange={event => patch({ indicator_condition: { ...draft.config.indicator_condition!, column: event.target.value } })}>{available.map(column => <option key={column}>{column}</option>)}</select></label><label>Mínimo original<input type="number" value={draft.config.indicator_condition.minimum} onChange={event => patch({ indicator_condition: { ...draft.config.indicator_condition!, minimum: Number(event.target.value) } })} /></label></div>}
        <label className="generator-check"><input type="checkbox" checked={!!draft.config.indicator_ratio} onChange={event => patch({ indicator_ratio: event.target.checked ? { denominator: available[0] || '', scale: 100 } : null })} />Cociente original del indicador</label>
        {draft.config.indicator_ratio && <div className="generator-controls"><label>Denominador original<select value={draft.config.indicator_ratio.denominator} onChange={event => patch({ indicator_ratio: { ...draft.config.indicator_ratio!, denominator: event.target.value } })}>{available.map(column => <option key={column}>{column}</option>)}</select></label><label>Escala original<input type="number" value={draft.config.indicator_ratio.scale} onChange={event => patch({ indicator_ratio: { ...draft.config.indicator_ratio!, scale: Number(event.target.value) } })} /></label></div>}
        <label>Columnas que se suman al indicador<input value={(draft.config.indicator_addends || []).join(';')} onChange={event => patch({ indicator_addends: event.target.value ? event.target.value.split(';') : [] })} /></label>
        <label>Columnas que deben tener un valor único<input value={(draft.config.indicator_single_value_columns || []).join(';')} onChange={event => patch({ indicator_single_value_columns: event.target.value ? event.target.value.split(';') : [] })} /></label>
      </fieldset>
      <details><summary>Preparación y configuraciones especializadas existentes</summary><p className="generator-hint">Se conserva la estructura original. Cambiá únicamente la configuración que necesites editar.</p>
        {Object.entries(preparationNames).map(([key, label]) => <label key={key}>{label}<textarea rows={4} value={preparation[key] || 'null'} onChange={event => {
          const text = event.target.value;
          setPreparation(previous => ({ ...previous, [key]: text })); setError('');
          if (['computed_columns', 'aggregate_join', 'google_summary'].includes(key)) {
            try {
              const value = JSON.parse(text);
              setDraft(previous => { const config = { ...previous.config }; if (value === null) delete config[key as keyof ChartConfig]; else Object.assign(config, { [key]: value }); return { ...previous, config }; });
            } catch { setPreview(null); setError(`Revisá ${label}: la configuración todavía está incompleta.`); }
          }
        }} spellCheck={false} /></label>)}
      </details>
    </div></DialogContent><DialogActions><Button onClick={onClose}>Cancelar</Button><Button variant="contained" disabled={loading || !!error} onClick={apply}>Aplicar opciones del gráfico</Button></DialogActions>
  </Dialog>;
}
