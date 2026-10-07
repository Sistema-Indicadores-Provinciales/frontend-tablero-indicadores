import { Alert, Button } from '@mui/material';
import { SectionWidgetRender, Widget } from 'types/Generator';
import GeneratorChart from './GeneratorChart';

export default function SavedChart({ widget, rendered, updating = false, onRetry }: {
  widget: Widget;
  rendered?: SectionWidgetRender;
  updating?: boolean;
  onRetry?: () => void;
}) {
  const result = rendered?.data;
  const isCounter = widget.config.chart_type === 'indicator';
  const recordCount = result && <p className="generator-hint">{result.filtered_rows.toLocaleString('es-AR')} registros</p>;
  return <section className={`generator-panel generator-widget${isCounter ? ' generator-counter' : ''}`} aria-label={widget.title}
    aria-busy={updating || undefined} data-updating={updating && !!result} style={isCounter ? undefined : { gridColumn: `span ${widget.width}` }}>
    <h2>{widget.title}</h2>
    {result ? <div className="generator-chart-content">
      {!isCounter && recordCount}
      {!!result.ignored_filters?.length && <p className="generator-hint">Este gráfico no tiene los campos: {result.ignored_filters.join(', ')}. Se aplican los demás filtros.</p>}
      {result.filtered_rows === 0 ? <Alert severity="info">No hay datos para los filtros seleccionados.</Alert> : <GeneratorChart widget={widget} result={result} showIndicatorTitle={!isCounter} />}
      {isCounter && recordCount}
      {!!result.warnings.length && <details className="generator-hint"><summary>Notas sobre los datos</summary>{result.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details>}
    </div> : rendered?.error ? <Alert severity="error" action={onRetry && <Button onClick={onRetry}>Reintentar</Button>}>{rendered.error}</Alert>
      : updating && <p role="status" className="generator-loading">Cargando gráfico…</p>}
  </section>;
}
