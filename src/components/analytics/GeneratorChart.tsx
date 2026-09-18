import { lazy, Suspense } from 'react';
import { ChartData, Widget } from 'types/Generator';
const Plot = lazy(() => import('react-plotly.js'));
const ECharts = lazy(() => import('echarts-for-react'));
const colors = ['#2563eb', '#e11d48', '#f97316', '#16a34a', '#9333ea', '#0891b2', '#ca8a04'];
const quantile = (a: number[], p: number) => {
  const index = (a.length - 1) * p, low = Math.floor(index);
  return a[low] + (a[Math.ceil(index)] - a[low]) * (index - low);
};
export default function GeneratorChart({ widget, result }: { widget: Widget; result: ChartData }) {
  const kind = widget.config.chart_type;
  if (kind === 'table') return <div className="generator-table"><table><thead><tr>{result.columns?.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{result.records?.map((row, i) => <tr key={i}>{result.columns?.map(c => <td key={c}>{String(row[c] ?? '—')}</td>)}</tr>)}</tbody></table></div>;
  if (!result.datasets.length) return <p>No hay datos para los filtros seleccionados.</p>;
  if (kind === 'indicator') return <div className="generator-indicator"><strong>{result.datasets[0].data[0]?.toLocaleString('es-AR') ?? 'Sin datos'}</strong><span>{widget.title}</span></div>;
  let labels = result.labels.map(v => v == null ? 'Sin dato' : v);
  let datasets = result.datasets;
  let renderKind: string = kind;
  if (kind === 'histogram') {
    const values = datasets.flatMap(s => s.data.filter((v): v is number => v !== null));
    const min = Math.min(...values), max = Math.max(...values);
    const bins = Math.min(40, Math.max(1, Math.ceil(Math.sqrt(values.length))));
    const step = (max - min) / bins || 1;
    labels = Array.from({ length: bins }, (_, i) => `${(min + i * step).toLocaleString('es-AR', { maximumFractionDigits: 2 })} – ${(min + (i + 1) * step).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`);
    datasets = datasets.map(s => {
      const data = Array(bins).fill(0) as number[];
      s.data.forEach(v => { if (v !== null) data[Math.min(bins - 1, Math.floor((v - min) / step))]++; });
      return { label: s.label, data };
    });
    renderKind = 'bar';
  }
  const xLabel = kind === 'histogram' ? widget.config.y_col : widget.config.x_col;
  const yLabel = kind === 'histogram' || widget.config.aggregation === 'count' ? 'Registros' : widget.config.y_col;
  const pie = kind === 'pie' || kind === 'donut';
  if (widget.library === 'ECharts') {
    let series: any[] = datasets.map(s => ({
      name: s.label, type: ['bar', 'horizontal', 'stacked'].includes(renderKind) ? 'bar' : renderKind === 'scatter' ? 'scatter' : 'line',
      data: renderKind === 'scatter' ? s.data.map((v, i) => [s.x?.[i], v]) : s.data,
      stack: kind === 'stacked' ? 'total' : undefined,
      areaStyle: kind === 'area' ? {} : undefined, connectNulls: false,
    }));
    let xAxis: any = { type: kind === 'scatter' ? 'value' : 'category', data: labels, name: xLabel, axisLabel: { hideOverlap: true } };
    let yAxis: any = { type: 'value', name: yLabel };
    if (kind === 'horizontal') [xAxis, yAxis] = [yAxis, xAxis];
    if (pie) {
      series = [{ type: 'pie', radius: kind === 'donut' ? ['40%', '65%'] : '65%', data: labels.map((name, i) => ({ name: String(name), value: datasets[0].data[i] })) }];
      xAxis = yAxis = undefined;
    }
    if (kind === 'box') {
      series = [{ type: 'boxplot', data: datasets.map(s => {
        const a = s.data.filter((v): v is number => v !== null).sort((a, b) => a - b);
        return [a[0], quantile(a, .25), quantile(a, .5), quantile(a, .75), a[a.length - 1]];
      }) }];
      xAxis = { type: 'category', data: datasets.map(s => s.label) };
    }
    const heatValues = datasets.flatMap(s => s.data.filter((v): v is number => v !== null));
    if (kind === 'heatmap') {
      yAxis = { type: 'category', data: datasets.map(s => s.label) };
      series = [{ type: 'heatmap', data: datasets.flatMap((s, row) => s.data.flatMap((v, col) => v == null ? [] : [[col, row, v]])) }];
    }
    return <Suspense fallback={<p>Cargando gráfico…</p>}><ECharts notMerge style={{ height: 450 }} option={{
      color: colors, tooltip: { trigger: pie || kind === 'scatter' || kind === 'heatmap' ? 'item' : 'axis', renderMode: 'richText' },
      legend: { type: 'scroll', bottom: 0 }, grid: { left: 75, right: 35, top: 45, bottom: 85 },
      xAxis, yAxis, series,
      visualMap: kind === 'heatmap' ? { min: Math.min(...heatValues), max: Math.max(...heatValues), calculable: true, orient: 'horizontal', top: 0 } : undefined,
    }} /></Suspense>;
  }
  let traces: any[] = datasets.map((s, i) => ({
    name: s.label, x: kind === 'scatter' ? s.x : labels, y: s.data,
    type: ['bar', 'horizontal', 'stacked'].includes(renderKind) ? 'bar' : 'scatter',
    mode: kind === 'scatter' ? 'markers' : 'lines+markers',
    fill: kind === 'area' ? 'tozeroy' : undefined,
    marker: { color: colors[i % colors.length] }, connectgaps: false,
  }));
  if (kind === 'horizontal') traces = traces.map(t => ({ ...t, x: t.y, y: t.x, orientation: 'h' }));
  if (pie) traces = [{ type: 'pie', labels, values: datasets[0].data, hole: kind === 'donut' ? .45 : 0, marker: { colors } }];
  if (kind === 'box') traces = datasets.map(s => {
    const a = s.data.filter((v): v is number => v !== null).sort((a, b) => a - b);
    return { type: 'box', name: s.label, q1: [quantile(a, .25)], median: [quantile(a, .5)], q3: [quantile(a, .75)], lowerfence: [a[0]], upperfence: [a[a.length - 1]], boxpoints: false };
  });
  if (kind === 'heatmap') traces = [{ type: 'heatmap', x: labels, y: datasets.map(s => s.label), z: datasets.map(s => s.data), colorscale: 'Blues', hoverongaps: false }];
  return <Suspense fallback={<p>Cargando gráfico…</p>}><Plot data={traces} layout={{
    autosize: true, height: 450, margin: { l: 75, r: 35, b: 90, t: 35 },
    xaxis: { title: { text: kind === 'horizontal' ? yLabel : xLabel }, automargin: true },
    yaxis: { title: { text: kind === 'horizontal' ? xLabel : yLabel }, automargin: true },
    barmode: kind === 'stacked' ? 'stack' : 'group', legend: { orientation: 'h', y: -0.25 },
  }} config={{ responsive: true, displaylogo: false }} useResizeHandler style={{ width: '100%' }} /></Suspense>;
}
