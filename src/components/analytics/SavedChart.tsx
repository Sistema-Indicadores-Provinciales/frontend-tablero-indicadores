import { useEffect, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { isAxiosError } from 'axios';
import { analytics, errorMessage } from 'config/Analytics';
import { ChartData, ChartFilterOptions, SectionFilters, Widget } from 'types/Generator';
import GeneratorChart from './GeneratorChart';

// Keep large sections from opening dozens of simultaneous spreadsheet downloads.
let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T | undefined> {
  if (active >= 3) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
  try { return signal.aborted ? undefined : await run(); }
  finally { const next = waiting.shift(); if (next) next(); else active--; }
}

export default function SavedChart({ workspaceId, widget, googleToken, filters, onOptions }: {
  workspaceId: string; widget: Widget; googleToken: string; filters: SectionFilters;
  onOptions: (response: ChartFilterOptions, deniedMessage?: string) => void;
}) {
  const [result, setResult] = useState<ChartData | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(''); setResult(null);
    onOptions({ widget, filters });
    limited(async () => {
      const url = `/v2/workspaces/${encodeURIComponent(workspaceId)}/widgets/${encodeURIComponent(widget.id)}/chart`;
      const config = { signal: controller.signal, headers: googleToken ? { 'X-Google-Access-Token': googleToken } : {} };
      const response = Object.values(filters).some(values => values.length)
        ? await analytics.post<ChartData>(url, { filters }, config)
        : await analytics.get<ChartData>(url, config);
      if (!controller.signal.aborted) {
        setResult(response.data);
        onOptions({ widget, filters, options: response.data.filter_options || {}, ignoredFilters: response.data.ignored_filters });
      }
    }, controller.signal).catch(e => {
      if (!controller.signal.aborted) {
        setError(errorMessage(e));
        // Do not leave previously accessible values on screen after permission is revoked.
        const denied = isAxiosError(e) && [401, 403, 404].includes(e.response?.status || 0);
        onOptions({ widget, filters, options: null }, denied ? errorMessage(e) : undefined);
      }
    }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [workspaceId, widget, googleToken, filters, retry, onOptions]);
  const isCounter = widget.config.chart_type === 'indicator';
  const recordCount = result && <p className="generator-hint">{result.filtered_rows.toLocaleString('es-AR')} registros</p>;
  return <section className={`generator-panel generator-widget${isCounter ? ' generator-counter' : ''}`} aria-label={widget.title} style={isCounter ? undefined : { gridColumn: `span ${widget.width}` }}>
    <h2>{widget.title}</h2>
    {busy ? <p role="status" className="generator-loading">Cargando gráfico…</p> : error ? <Alert severity="error" action={<Button onClick={() => setRetry(v => v + 1)}>Reintentar</Button>}>{error}</Alert> : result && <>
      {!isCounter && recordCount}
      {!!result.ignored_filters?.length && <p className="generator-hint">Este gráfico no tiene los campos: {result.ignored_filters.join(', ')}. Se aplican los demás filtros.</p>}
      {result.filtered_rows === 0 ? <Alert severity="info">No hay datos para los filtros seleccionados.</Alert> : <GeneratorChart widget={widget} result={result} showIndicatorTitle={!isCounter} />}
      {isCounter && recordCount}
      {!!result.warnings.length && <details className="generator-hint"><summary>Notas sobre los datos</summary>{result.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details>}
    </>}
  </section>;
}
