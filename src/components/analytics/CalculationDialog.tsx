import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { analytics, errorMessage } from 'config/Analytics';
import type { CalculatedField, ChartConfig, NumericFormat, Widget } from 'types/Generator';
import { equalValues } from 'utils/editorDraft';
import { basicNumericFormat } from 'utils/metricPresentation';
import { calculationTemplates, Clause, Operand, quotedField, recognizeArithmetic, ResultValue, Template, templateExpression } from 'utils/calculationTemplates';

type Guide = { template: Template; first: Operand; second: Operand; clauses: Clause[]; fallback: ResultValue };
const result = (): ResultValue => ({ kind: 'null', value: '' });
const clause = (field = ''): Clause => ({ field, comparison: '=', value: { kind: 'number', value: '2025' }, result: result() });

function ResultControl({ title, value, columns, onChange }: { title: string; value: ResultValue; columns: string[]; onChange: (value: ResultValue) => void }) {
  return <div className="generator-result-control"><label>{title}: tipo<select value={value.kind} onChange={event => onChange({ ...value, kind: event.target.value as ResultValue['kind'] })}>
    <option value="number">Número</option><option value="text">Texto</option><option value="field">Otro campo</option><option value="null">NULL</option>
  </select></label>{value.kind === 'field' ? <label>{title}<select value={value.value} onChange={event => onChange({ ...value, value: event.target.value })}><option value="">Elegir campo</option>{columns.map(column => <option key={column}>{column}</option>)}</select></label>
    : value.kind !== 'null' && <label>{title}<input type={value.kind === 'number' ? 'number' : 'text'} value={value.value} onChange={event => onChange({ ...value, value: event.target.value })} /></label>}</div>;
}

export function FormatControl({ value, onChange }: { value?: NumericFormat; onChange: (format: NumericFormat) => void }) {
  const format = value || basicNumericFormat;
  const patch = (update: Partial<NumericFormat>) => onChange({ ...format, ...update });
  return <fieldset><legend>Formato del resultado</legend><div className="generator-controls">
    <label>Formato común<select value="" onChange={event => {
      const [style, decimals] = event.target.value.split(':');
      if (style) patch({ style: style as NumericFormat['style'], decimals: Number(decimals), suffix: '' });
    }}><option value="">Elegir configuración</option><option value="number:0">Número sin decimales</option><option value="number:2">Número con dos decimales</option><option value="percent:0">Porcentaje sin decimales</option><option value="percent:2">Porcentaje con dos decimales</option><option value="literal:0">Porcentaje ya multiplicado por 100</option></select></label>
    <label>Escala<select value={format.style} onChange={event => patch({ style: event.target.value as NumericFormat['style'] })}><option value="number">Valor nominal</option><option value="percent">Proporción × 100 y %</option><option value="literal">Valor nominal con % literal</option></select></label>
    <label>Decimales<input type="number" min={0} max={20} value={format.decimals} onChange={event => patch({ decimals: Number(event.target.value) })} /></label>
    <label>Separador de decimales<select value={format.decimal_separator || ','} onChange={event => patch({ decimal_separator: event.target.value as ',' | '.' })}><option value=",">Coma</option><option value=".">Punto</option></select></label>
    <label>Separador de miles<select value={format.thousands_separator ?? '.'} onChange={event => patch({ thousands_separator: event.target.value as ',' | '.' | ' ' })}><option value=".">Punto</option><option value=",">Coma</option><option value=" ">Espacio</option></select></label>
    <label>Prefijo<input value={format.prefix} onChange={event => patch({ prefix: event.target.value })} /></label><label>Sufijo<input value={format.suffix} onChange={event => patch({ suffix: event.target.value })} /></label>
    <label>Valor vacío<input value={format.empty} onChange={event => patch({ empty: event.target.value })} /></label>
    <label className="generator-check"><input type="checkbox" checked={format.grouping} onChange={event => patch({ grouping: event.target.checked })} />Separador de miles</label>
  </div></fieldset>;
}

export default function CalculationDialog({ open, widget, columns, sourceName, sourceLabel, config, headers, copies, onClose, onApply }: {
  open: boolean; widget: Widget; columns: string[]; sourceName: string; config: ChartConfig; headers: Record<string, string>;
  sourceLabel?: string;
  copies: { label: string; widget: Widget }[]; onClose: () => void; onApply: (config: ChartConfig) => void;
}) {
  const [fields, setFields] = useState<CalculatedField[]>([]), [index, setIndex] = useState(0);
  const [formats, setFormats] = useState<Record<string, NumericFormat>>({});
  const [guide, setGuide] = useState<Guide>({ template: 'custom', first: { field: '', aggregation: 'row' }, second: { field: '', aggregation: 'row' }, clauses: [clause()], fallback: result() });
  const [condition, setCondition] = useState<ChartConfig['display_condition']>(null);
  const [hideZero, setHideZero] = useState(false), [emptyText, setEmptyText] = useState('—');
  const [error, setError] = useState(''), [trial, setTrial] = useState(''), [testing, setTesting] = useState(false);
  const request = useRef<AbortController | null>(null);
  const [guardColumn, setGuardColumn] = useState(''), [guardFunction, setGuardFunction] = useState('COUNT'), [guardLimit, setGuardLimit] = useState('1');
  const [guardOperator, setGuardOperator] = useState('<='), [guardJoin, setGuardJoin] = useState('AND');
  const selected = fields[index];
  const options = [...new Set([...columns, ...fields.map(field => field.name)])];
  const loadGuide = (field?: CalculatedField) => {
    const recognized = field ? recognizeArithmetic(field.expression) : null;
    setGuide(field?.guide as unknown as Guide || { template: recognized?.template || 'custom', first: recognized?.first || { field: columns[0] || '', aggregation: 'row' },
      second: recognized?.second || { field: columns[1] || columns[0] || '', aggregation: 'row' }, clauses: [clause(columns[0])], fallback: result() });
  };
  useEffect(() => {
    if (!open) return;
    const initial = structuredClone(widget.config.calculated_fields || []);
    setFields(initial); setIndex(0); loadGuide(initial[0]);
    setFormats(structuredClone(widget.config.numeric_formats || {}));
    setCondition(structuredClone(widget.config.display_condition || null));
    setHideZero(!!widget.config.hide_zero); setEmptyText(widget.config.empty_text ?? '—'); setError(''); setTrial('');
  }, [open]);
  useEffect(() => { request.current?.abort(); setTrial(''); setTesting(false); return () => request.current?.abort(); }, [fields, condition, open]);
  const editField = (patch: Partial<CalculatedField>) => { setFields(previous => previous.map((field, position) => position === index ? { ...field, ...patch } : field)); setTrial(''); };
  const editGuide = (patch: Partial<Guide>) => {
    const next = { ...guide, ...patch }; setGuide(next);
    if (next.template !== 'custom') {
      const expression = templateExpression(next.template, next.first, next.second, next.clauses, next.fallback);
      const mode = /\b(SUM|AVG|MIN|MAX|MEDIAN|COUNT|COUNT_DISTINCT|SELECTED_COUNT)\s*\(/i.test(expression) ? 'aggregate' : 'row';
      editField({ expression, mode, guide: next });
    }
  };
  const test = async () => {
    if (!selected) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setTesting(true); setError(''); setTrial('');
    try {
      const response = await analytics.post<{ sample_rows: number; matching_rows: number; values: unknown[] }>(`/v2/sources/${encodeURIComponent(sourceName)}/formula-trial`, {
        config: { ...config, calculated_fields: fields }, field: selected,
      }, { headers, signal: controller.signal });
      if (!controller.signal.aborted) setTrial(`Muestra: ${response.data.sample_rows} de ${response.data.matching_rows} registros filtrados. Resultado: ${JSON.stringify(response.data.values)}`);
    } catch (reason) { if (!controller.signal.aborted) setError(errorMessage(reason)); } finally { if (!controller.signal.aborted) setTesting(false); }
  };
  const apply = () => {
    const names = fields.map(field => field.name.trim().toLocaleLowerCase('es'));
    if (fields.some(field => !field.name.trim() || !field.expression.trim()) || new Set(names).size !== names.length || names.some(name => columns.some(column => column.toLocaleLowerCase('es') === name))) {
      setError('Cada campo necesita un nombre único y una expresión. Los nombres deben diferir de las columnas de la fuente.'); return;
    }
    const next = { ...widget.config };
    if (!equalValues(fields, widget.config.calculated_fields || [])) next.calculated_fields = fields;
    if (!equalValues(formats, widget.config.numeric_formats || {})) next.numeric_formats = formats;
    if (!equalValues(condition, widget.config.display_condition || null)) next.display_condition = condition;
    if (hideZero !== !!widget.config.hide_zero) next.hide_zero = hideZero;
    if (emptyText !== (widget.config.empty_text ?? '—')) next.empty_text = emptyText;
    onApply(next); onClose();
  };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="calculation-title">
    <DialogTitle id="calculation-title">Campos calculados y condiciones · {widget.title}</DialogTitle>
    <DialogContent><div className="generator generator-lab">
      <p>Fuente: {sourceLabel || sourceName} · Hoja: {config.sheet}. Las pruebas usan hasta 20 registros después de aplicar las restricciones y los filtros iniciales.</p>
      {error && <Alert severity="error">{error}</Alert>}
      <div className="generator-controls"><label>Campo calculado<select value={fields.length ? index : ''} onChange={event => { const next = Number(event.target.value); setIndex(next); loadGuide(fields[next]); }}><option value="" disabled>Elegir campo</option>{fields.map((field, position) => <option key={position} value={position}>{field.name || 'Sin nombre'}</option>)}</select></label>
        <button type="button" disabled={fields.length >= 20} onClick={() => { const next = { name: '', expression: '', mode: 'row' as const }; setFields([...fields, next]); setIndex(fields.length); loadGuide(next); }}>Agregar campo calculado</button>
        {selected && <button type="button" onClick={() => { const next = fields.filter((_, position) => position !== index); setFields(next); setIndex(0); loadGuide(next[0]); }}>Quitar campo</button>}
        <label>Copiar desde otro gráfico<select value="" onChange={event => {
          const source = copies[Number(event.target.value)]?.widget;
          if (!source) return;
          if (source.config.calculated_fields?.some(field => fields.some(current => current.name.toLocaleLowerCase('es') === field.name.toLocaleLowerCase('es')))) { setError('Hay nombres duplicados entre los campos. Renombrá o quitá el conflicto antes de copiar.'); return; }
          setFields([...fields, ...structuredClone(source.config.calculated_fields || [])]); setFormats({ ...formats, ...structuredClone(source.config.numeric_formats || {}) }); setError('');
        }}><option value="">Elegir origen</option>{copies.map((copy, position) => <option key={position} value={position}>{copy.label}</option>)}</select></label>
      </div>
      {selected && <fieldset><legend>Definición del campo</legend><div className="generator-controls">
        <label>Nombre del campo<input value={selected.name} onChange={event => editField({ name: event.target.value })} maxLength={200} /></label>
        <label>Configuración común<select value={guide.template} onChange={event => editGuide({ template: event.target.value as Template })}>{calculationTemplates.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Evaluación<select value={selected.mode} onChange={event => editField({ mode: event.target.value as CalculatedField['mode'] })}><option value="row">Por fila y luego operación del gráfico</option><option value="aggregate">La expresión combina los registros</option></select></label>
      </div>
      {['quotient', 'difference', 'change'].includes(guide.template) && <div className="generator-controls">{(['first', 'second'] as const).map((key, position) => <div className="generator-result-control" key={key}>
        <label>Operando {position + 1}<select value={guide[key].field} onChange={event => editGuide({ [key]: { ...guide[key], field: event.target.value } })}>{options.map(column => <option key={column}>{column}</option>)}</select></label>
        <label>Evaluar operando {position + 1}<select value={guide[key].aggregation} onChange={event => editGuide({ [key]: { ...guide[key], aggregation: event.target.value } })}>{['row', 'SUM', 'AVG', 'MIN', 'MAX', 'MEDIAN', 'COUNT', 'COUNT_DISTINCT'].map(value => <option key={value} value={value}>{value === 'row' ? 'Valor por fila' : value}</option>)}</select></label>
      </div>)}</div>}
      {['if', 'case'].includes(guide.template) && <>{guide.clauses.slice(0, guide.template === 'if' ? 1 : undefined).map((item, position) => <fieldset key={position}><legend>Condición {position + 1}</legend><div className="generator-controls">
        <label>Campo de condición<select value={item.field} onChange={event => editGuide({ clauses: guide.clauses.map((current, i) => i === position ? { ...current, field: event.target.value } : current) })}>{options.map(column => <option key={column}>{column}</option>)}</select></label>
        <label>Comparación<select value={item.comparison} onChange={event => editGuide({ clauses: guide.clauses.map((current, i) => i === position ? { ...current, comparison: event.target.value } : current) })}>{['=', '!=', '<', '<=', '>', '>=', 'IS NULL', 'IS NOT NULL'].map(value => <option key={value}>{value}</option>)}</select></label>
        {!item.comparison.startsWith('IS ') && <ResultControl title="Comparar con" value={item.value} columns={options} onChange={value => editGuide({ clauses: guide.clauses.map((current, i) => i === position ? { ...current, value } : current) })} />}
        <ResultControl title="Resultado" value={item.result} columns={options} onChange={value => editGuide({ clauses: guide.clauses.map((current, i) => i === position ? { ...current, result: value } : current) })} />
        {guide.template === 'case' && <button disabled={guide.clauses.length === 1} onClick={() => editGuide({ clauses: guide.clauses.filter((_, i) => i !== position) })}>Quitar condición</button>}
      </div></fieldset>)}
        {guide.template === 'case' && <button onClick={() => editGuide({ clauses: [...guide.clauses, clause(columns[0])] })}>Agregar condición CASE</button>}
        <ResultControl title="Resultado por defecto" value={guide.fallback} columns={options} onChange={fallback => editGuide({ fallback })} />
      </>}
      <label>Expresión<textarea rows={5} value={selected.expression} maxLength={2000} onChange={event => { setGuide({ ...guide, template: 'custom' }); editField({ expression: event.target.value, guide: undefined }); }} /></label>
      <p className="generator-hint">Referencias entre corchetes. La variación guiada produce una proporción: elegí formato porcentual para presentarla.</p>
      <button disabled={testing || !selected.name || !selected.expression} onClick={() => void test()}>{testing ? 'Probando muestra…' : 'Probar expresión en muestra'}</button>
      {trial && <p role="status">{trial}</p>}
      <FormatControl value={formats[selected.name]} onChange={format => setFormats({ ...formats, [selected.name]: format })} />
      </fieldset>}
      <fieldset><legend>Cuándo mostrar el valor del indicador</legend><div className="generator-controls">
        <label>Función de conteo<select value={guardFunction} onChange={event => setGuardFunction(event.target.value)}><option>COUNT</option><option>COUNT_DISTINCT</option><option>SELECTED_COUNT</option></select></label>
        <label>Columna o filtro<select value={guardColumn} onChange={event => setGuardColumn(event.target.value)}><option value="">Elegir</option>{options.map(column => <option key={column}>{column}</option>)}</select></label>
        <label>Comparación de conteo<select value={guardOperator} onChange={event => setGuardOperator(event.target.value)}>{['=', '!=', '<', '<=', '>', '>='].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Límite<input type="number" value={guardLimit} onChange={event => setGuardLimit(event.target.value)} /></label>
        <label>Combinar con<select value={guardJoin} onChange={event => setGuardJoin(event.target.value)}><option>AND</option><option>OR</option></select></label>
        <button disabled={!guardColumn} onClick={() => { const addition = `${guardFunction}(${quotedField(guardColumn)}) ${guardOperator} ${guardLimit}`; setCondition({ expression: condition?.expression ? `(${condition.expression}) ${guardJoin} (${addition})` : addition, alternative: condition?.alternative ?? '—' }); }}>Agregar condición de visualización</button>
      </div>
      <label>Condición personalizada<textarea value={condition?.expression || ''} rows={3} onChange={event => setCondition(event.target.value ? { expression: event.target.value, alternative: condition?.alternative ?? '—' } : null)} /></label>
      <label>Texto alternativo<input value={condition?.alternative ?? '—'} onChange={event => setCondition({ expression: condition?.expression || 'TRUE', alternative: event.target.value })} /></label>
      <p className="generator-hint">COUNT cuenta registros con valor; COUNT_DISTINCT cuenta valores presentes diferentes; SELECTED_COUNT cuenta opciones incluidas en el filtro.</p>
      <label className="generator-check"><input type="checkbox" checked={hideZero} onChange={event => setHideZero(event.target.checked)} />Ocultar valores cero</label>
      <label>Texto para valores vacíos<input value={emptyText} onChange={event => setEmptyText(event.target.value)} /></label>
      </fieldset>
    </div></DialogContent><DialogActions><Button onClick={onClose}>Cancelar</Button><Button variant="contained" onClick={apply}>Aplicar cálculos y condiciones</Button></DialogActions>
  </Dialog>;
}
