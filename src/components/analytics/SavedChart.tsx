import { Alert, Button } from '@mui/material';
import { ColumnAliases, SectionWidgetRender, Widget } from 'types/Generator';
import { columnLabel } from 'utils/generatorConfig';
import GeneratorChart from './GeneratorChart';
import SectionIllustration from './SectionIllustration';
import type { HealthIllustration } from './healthSectionDesigns';

export default function SavedChart({ widget, rendered, updating = false, onRetry, aliases, illustration }: {
  widget: Widget;
  rendered?: SectionWidgetRender;
  updating?: boolean;
  onRetry?: () => void;
  aliases?: ColumnAliases;
  illustration?: HealthIllustration;
}) {
  const result = rendered?.data;
  const isCounter = widget.config.chart_type === 'indicator';
  const recordCount = result && <p className="generator-hint">{result.filtered_rows.toLocaleString('es-AR')} registros</p>;
  return <section className={`generator-panel generator-widget${isCounter ? ' generator-counter' : ''}${illustration ? ' generator-counter-illustrated' : ''}`} aria-label={widget.title}
    aria-busy={updating || undefined} data-updating={updating && !!result} style={isCounter ? undefined : { gridColumn: `span ${widget.width}` }}>
    {illustration ? <div className="generator-counter-heading"><h2>{widget.title}</h2><SectionIllustration name={illustration} decorative /></div> : <h2>{widget.title}</h2>}
    {result ? <div className="generator-chart-content">
      {!isCounter && recordCount}
      {!!result.ignored_filters?.length && <p className="generator-hint">Este gráfico no tiene los campos: {result.ignored_filters.map(column => columnLabel(column, aliases)).join(', ')}. Se aplican los demás filtros.</p>}
      {result.filtered_rows === 0 && !(isCounter && widget.config.indicator_empty === 'zero') ? <Alert severity="info">No hay datos para los filtros seleccionados.</Alert> : <GeneratorChart widget={widget} result={result} showIndicatorTitle={!isCounter} aliases={aliases} />}
      {isCounter && recordCount}
      {!!result.warnings.length && <details className="generator-hint"><summary>Notas sobre los datos</summary>{result.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details>}
    </div> : rendered?.error ? <Alert severity="error" action={onRetry && <Button onClick={onRetry}>Reintentar</Button>}>{rendered.error}</Alert>
      : updating && <p role="status" className="generator-loading">Cargando gráfico…</p>}
  </section>;
}
