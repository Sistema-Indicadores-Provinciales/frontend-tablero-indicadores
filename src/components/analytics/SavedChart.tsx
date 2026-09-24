import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import { isAxiosError } from 'axios';
import { analytics, errorMessage } from 'config/Analytics';
import { ChartData, Widget } from 'types/Generator';
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

type Filters = Record<string, string[]>;
export default function SavedChart({ workspaceId, widget, googleToken }: { workspaceId: string; widget: Widget; googleToken: string }) {
  const [result, setResult] = useState<ChartData | null>(null);
  const [options, setOptions] = useState<NonNullable<ChartData['filter_options']>>({});
  const [draft, setDraft] = useState<Filters>({}), [filters, setFilters] = useState<Filters>({});
  const [busy, setBusy] = useState(true), [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(''); setResult(null);
    limited(async () => {
      const url = `/v2/workspaces/${encodeURIComponent(workspaceId)}/widgets/${encodeURIComponent(widget.id)}/chart`;
      const config = { signal: controller.signal, headers: googleToken ? { 'X-Google-Access-Token': googleToken } : {} };
      const response = Object.values(filters).some(values => values.length)
        ? await analytics.post<ChartData>(url, { filters }, config)
        : await analytics.get<ChartData>(url, config);
      if (!controller.signal.aborted) { setResult(response.data); setOptions(response.data.filter_options || {}); }
    }, controller.signal).catch(e => {
      if (!controller.signal.aborted) {
        setError(errorMessage(e));
        // Do not leave previously accessible values on screen after permission is revoked.
        if (isAxiosError(e) && [401, 403, 404].includes(e.response?.status || 0)) setOptions({});
      }
    }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [workspaceId, widget, googleToken, filters, retry]);
  const count = Object.values(filters).filter(values => values.length).length;
  return <section className="generator-panel generator-widget" aria-label={widget.title} style={{ gridColumn: `span ${widget.width}` }}>
    <h2>{widget.title}</h2>
    {!!Object.keys(options).length && <Box component="section" aria-label={`Filtros de ${widget.title}`} sx={{ bgcolor: '#f7fafc', border: '1px solid #dbe3ec', borderRadius: 2, p: 2, mb: 2 }}>
      <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1 }}><FilterAltOutlinedIcon sx={{ color: '#00558a' }} /><Typography fontWeight={600}>Filtrar este gráfico</Typography>{count > 0 && <Chip size="small" label={`${count} activos`} />}</Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Los filtros se aplican solo a tu vista, dentro de los datos guardados en el gráfico.</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 2 }}>
        {Object.entries(options).map(([column, values]) => <Autocomplete key={column} multiple freeSolo size="small" options={values.values} value={draft[column] || []}
          disabled={busy} onChange={(_, selection) => setDraft(prev => ({ ...prev, [column]: selection }))}
          renderInput={params => <TextField {...params} label={column} placeholder="Todos" helperText={values.total > 100 ? 'Escribí un valor y presioná Enter para buscar fuera de las sugerencias.' : undefined} />} />)}
      </Box>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 2 }}>
        <Button variant="contained" disabled={busy} onClick={() => { setFilters({ ...draft }); setRetry(v => v + 1); }}>Aplicar filtros</Button>
        <Button disabled={busy || !Object.values(draft).some(v => v.length) && !count} onClick={() => { setDraft({}); setFilters({}); }}>Limpiar filtros</Button>
      </Stack>
    </Box>}
    {busy ? <p role="status" className="generator-loading">Cargando gráfico…</p> : error ? <Alert severity="error" action={<Button onClick={() => setRetry(v => v + 1)}>Reintentar</Button>}>{error}</Alert> : result && <>
      <p className="generator-hint">{result.filtered_rows.toLocaleString('es-AR')} registros</p>
      {result.filtered_rows === 0 ? <Alert severity="info">No hay datos para los filtros seleccionados.</Alert> : <GeneratorChart widget={widget} result={result} />}
      {!!result.warnings.length && <details className="generator-hint"><summary>Notas sobre los datos</summary>{result.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details>}
    </>}
  </section>;
}
