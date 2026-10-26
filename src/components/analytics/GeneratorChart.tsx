import { ComponentProps, lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import type EChartsReact from 'echarts-for-react';
import { ChartData, ColumnAliases, Scalar, Widget } from 'types/Generator';
import { useChartTheme } from 'utils/charts/chartTheme';
import { columnLabel } from 'utils/generatorConfig';
import { formatChartValue, plotlyAxisFormat } from 'utils/charts/customValueFormat';
const Plot = lazy(() => import('react-plotly.js'));
const ECharts = lazy(() => import('echarts-for-react'));
const MapsChart = lazy(() => import('components/graphics/MapsChart'));
function ResponsiveECharts(props: ComponentProps<typeof ECharts>) {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsReact>(null);
  const resize = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance();
    if (chart && !chart.isDisposed()) chart.resize({ width: 'auto', height: 'auto' });
  }, []);
  useEffect(() => {
    // Observe every size change, including one during the initial chart animation.
    const observer = new ResizeObserver(resize);
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [resize]);
  return <div ref={container} style={{ width: '100%', minWidth: 0 }}><ECharts {...props} ref={chartRef} autoResize={false} onChartReady={resize} /></div>;
}
const quantile = (a: number[], p: number) => {
  const index = (a.length - 1) * p, low = Math.floor(index);
  return a[low] + (a[Math.ceil(index)] - a[low]) * (index - low);
};
const mapValue = (value: Scalar, format?: string) => value == null ? 'Sin dato'
  : typeof value === 'number' ? formatChartValue(value, format)
  : typeof value === 'boolean' ? value ? 'Sí' : 'No' : String(value);
const chartNumber = (value: number | null, format?: string) => formatChartValue(value, format);
const chartPercent = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`;
export default function GeneratorChart({ widget, result, showIndicatorTitle = true, aliases }: {
  widget: Widget; result: ChartData; showIndicatorTitle?: boolean; aliases?: ColumnAliases;
}) {
  const chartTheme = useChartTheme();
  const kind = widget.config.chart_type;
  const valueFormats = widget.config.value_formats || {};
  if (kind === 'table') return <div className="generator-table"><table><thead><tr>{result.columns?.map(c => <th key={c}>{columnLabel(c, aliases)}</th>)}</tr></thead><tbody>{result.records?.map((row, i) => <tr key={i}>{result.columns?.map(c => {
    const value = row[c];
    return <td key={c}>{typeof value === 'number' && valueFormats[c] ? formatChartValue(value, valueFormats[c]) : String(value ?? '—')}</td>;
  })}</tr>)}</tbody></table></div>;
  if (kind === 'map') {
    const points = result.map_points || [];
    if (!points.length) return <p>No hay coordenadas válidas para los filtros seleccionados.</p>;
    const magnitudes = points.map(point => Math.abs(point.value || 0)).filter(value => value > 0);
    const min = magnitudes.length ? Math.min(...magnitudes) : 0;
    const max = magnitudes.length ? Math.max(...magnitudes) : 0;
    const radius = (value?: number | null) => {
      if (!value || max === min) return 6000;
      return 2500 + ((Math.abs(value) - min) / (max - min)) * 22500;
    };
    const info = (point: NonNullable<ChartData['map_points']>[number]) => <div className="generator-map-info">
      <strong>{point.label}</strong>
      {!!point.metrics?.length && <dl>{point.metrics.map(metric => <div key={metric.field}><dt>{columnLabel(metric.field, aliases)}</dt><dd>{mapValue(metric.value, valueFormats[metric.field])}</dd></div>)}</dl>}
    </div>;
    const markers = points.map(point => ({ id: point.id, position: { lat: point.lat, lng: point.lng }, title: point.label, data: point, infoContent: info(point) }));
    const circles = points.map(point => ({ id: point.id, center: { lat: point.lat, lng: point.lng }, radius: radius(point.value), options: {
      fillColor: chartTheme.colors[0], fillOpacity: .32, strokeColor: chartTheme.colors[0], strokeOpacity: .8, strokeWeight: 1,
    }, data: point, infoContent: info(point) }));
    return <Suspense fallback={<p>Cargando mapa…</p>}><div className="generator-map"><MapsChart height="450px"
      displayMode={widget.config.map_mode || 'markers'} markers={markers} circles={circles} fitBounds highlightFormosa /></div></Suspense>;
  }
  if (!result.datasets.length) return <p>No hay datos para los filtros seleccionados.</p>;
  if (kind === 'indicator') return <div className="generator-indicator"><strong>{formatChartValue(result.datasets[0].data[0], valueFormats[widget.config.y_col])}</strong>{showIndicatorTitle && <span>{widget.title}</span>}</div>;
  let labels = result.labels.map(v => v == null ? 'Sin dato' : v);
  let datasets = result.datasets.map(dataset => ({ ...dataset, label: dataset.metric
    ? `${columnLabel(dataset.metric, aliases)}${dataset.group !== undefined ? ` · ${dataset.group}` : ''}`
    : !widget.config.group_col && kind !== 'box' ? columnLabel(dataset.label, aliases) : dataset.label }));
  const metricForDataset = (index: number) => datasets[index]?.metric || widget.config.y_col;
  const formatDatasetValue = (index: number, value: number | null | undefined) =>
    formatChartValue(value, kind === 'histogram' ? undefined : valueFormats[metricForDataset(index)]);
  const datasetFormats = datasets.map((_, index) => valueFormats[metricForDataset(index)] || '');
  const sharedFormat = kind !== 'histogram' && datasetFormats.length && datasetFormats.every(format => format === datasetFormats[0]) ? datasetFormats[0] : '';
  let renderKind: string = kind;
  if (kind === 'histogram') {
    const values = datasets.flatMap(s => s.data.filter((v): v is number => v !== null));
    const min = Math.min(...values), max = Math.max(...values);
    const bins = Math.min(40, Math.max(1, Math.ceil(Math.sqrt(values.length))));
    const step = (max - min) / bins || 1;
    labels = Array.from({ length: bins }, (_, i) =>
      `${formatChartValue(min + i * step, valueFormats[widget.config.y_col])} – ${formatChartValue(min + (i + 1) * step, valueFormats[widget.config.y_col])}`);
    datasets = datasets.map(s => {
      const data = Array(bins).fill(0) as number[];
      s.data.forEach(v => { if (v !== null) data[Math.min(bins - 1, Math.floor((v - min) / step))]++; });
      return { label: s.label, data };
    });
    renderKind = 'bar';
  }
  const xLabel = columnLabel(kind === 'histogram' ? widget.config.y_col : widget.config.x_col, aliases);
  const renderedMetrics = new Set(result.datasets.flatMap(dataset => dataset.metric ? [dataset.metric] : []));
  const yLabel = kind === 'histogram' || widget.config.aggregation === 'count'
    ? 'Registros'
    : renderedMetrics.size > 1 ? 'Valores' : columnLabel(widget.config.y_col, aliases);
  const pie = kind === 'pie' || kind === 'donut';
  const pieLabelMode = widget.config.pie_label_mode || 'percent';
  const pieValues = pie ? datasets[0].data : [];
  const pieTotal = pieValues.reduce<number>((total, value) => total + (value || 0), 0);
  const pieDetails = pieValues.map(value => ({
    value: chartNumber(value, valueFormats[widget.config.y_col]),
    percent: chartPercent(pieTotal && value != null ? value / pieTotal * 100 : 0),
  }));
  const pieInnerText = (index: number) => !pieValues[index] ? ''
    : pieLabelMode === 'value' ? pieDetails[index].value : pieDetails[index].percent;
  if (widget.library === 'ECharts') {
    let series: any[] = datasets.map(s => ({
      id: `series:${s.label}`, name: s.label,
      type: ['bar', 'horizontal', 'stacked'].includes(renderKind) ? 'bar' : renderKind === 'scatter' ? 'scatter' : 'line',
      data: renderKind === 'scatter' ? s.data.map((v, i) => [s.x?.[i], v]) : s.data.map((value, i) => ({ name: String(labels[i]), value })),
      stack: kind === 'stacked' ? 'total' : undefined,
      areaStyle: kind === 'area' ? {} : undefined, connectNulls: false, universalTransition: true,
    }));
    const axisStyle = {
      axisLabel: { color: chartTheme.textSecondary },
      axisLine: { lineStyle: { color: chartTheme.border } },
      splitLine: { lineStyle: { color: chartTheme.grid } },
      nameTextStyle: { color: chartTheme.textSecondary },
    };
    let xAxis: any = { ...axisStyle, type: kind === 'scatter' ? 'value' : 'category', data: labels, name: xLabel, axisLabel: { ...axisStyle.axisLabel, hideOverlap: true } };
    let yAxis: any = { ...axisStyle, type: 'value', name: yLabel,
      axisLabel: { ...axisStyle.axisLabel, formatter: sharedFormat ? (value: number) => formatChartValue(value, sharedFormat) : undefined } };
    if (kind === 'horizontal') [xAxis, yAxis] = [yAxis, xAxis];
    if (pie) {
      const radius = kind === 'donut' ? ['40%', '65%'] : '65%';
      const data = labels.map((name, i) => ({ id: String(name), name: String(name), value: pieValues[i] }));
      series = [
        { id: 'series:pie', type: 'pie', radius, universalTransition: true, data,
          label: { show: true, position: 'outside', formatter: '{b}' }, labelLine: { show: true } },
        { id: 'series:pie-values', type: 'pie', radius, silent: true, z: 3, animation: false, data,
          tooltip: { show: false }, itemStyle: { color: 'transparent' }, labelLine: { show: false },
          label: { show: true, position: 'inside', fontWeight: 700, fontSize: 12,
            color: chartTheme.mode === 'dark' ? '#10243b' : '#ffffff', formatter: (params: any) => pieInnerText(params.dataIndex) } },
      ];
      xAxis = yAxis = [];
    }
    if (kind === 'box') {
      series = [{ id: 'series:box', type: 'boxplot', universalTransition: true, data: datasets.map(s => {
        const a = s.data.filter((v): v is number => v !== null).sort((a, b) => a - b);
        return [a[0], quantile(a, .25), quantile(a, .5), quantile(a, .75), a[a.length - 1]];
      }) }];
      xAxis = { ...axisStyle, type: 'category', data: datasets.map(s => s.label) };
    }
    const heatValues = datasets.flatMap(s => s.data.filter((v): v is number => v !== null));
    if (kind === 'heatmap') {
      yAxis = { ...axisStyle, type: 'category', data: datasets.map(s => s.label) };
      series = [{ id: 'series:heatmap', type: 'heatmap', universalTransition: true,
        data: datasets.flatMap((s, row) => s.data.flatMap((v, col) => v == null ? [] : [[col, row, v]])) }];
    }
    return <Suspense fallback={<p>Cargando gráfico…</p>}><ResponsiveECharts style={{ height: 450 }} replaceMerge={['series', 'xAxis', 'yAxis', 'visualMap']} option={{
      color: chartTheme.colors,
      animationDurationUpdate: 320,
      animationEasingUpdate: 'cubicOut',
      backgroundColor: chartTheme.paper,
      textStyle: { color: chartTheme.text, fontFamily: chartTheme.fontFamily },
      tooltip: { trigger: pie || kind === 'scatter' || kind === 'heatmap' ? 'item' : 'axis', renderMode: 'richText', backgroundColor: chartTheme.tooltipBackground, borderColor: chartTheme.border,
        textStyle: { color: chartTheme.tooltipText, fontWeight: pie ? 700 : undefined },
        formatter: pie
          ? (params: any) => `${params.marker}${params.name}: ${pieDetails[params.dataIndex]?.value || chartNumber(params.value)} (${chartPercent(params.percent)})`
          : kind === 'box'
            ? (params: any) => {
                const values = (Array.isArray(params.value) ? params.value : []).slice(-5)
                  .map((value: number) => formatDatasetValue(params.dataIndex || 0, value));
                const labels = ['Mínimo', 'Q1', 'Mediana', 'Q3', 'Máximo'];
                return [`${params.marker || ''}${params.name || ''}`, ...values.map((value: string, index: number) => `${labels[index]}: ${value}`)].join('\n');
              }
          : (params: any) => {
              const items = Array.isArray(params) ? params : [params];
              const title = items[0]?.axisValueLabel ?? items[0]?.name;
              const lines = items.map((item: any) => {
                const raw = Array.isArray(item.value) ? item.value[item.value.length - 1] : item.value;
                const value = typeof raw === 'number' ? formatDatasetValue(item.seriesIndex || 0, raw) : String(raw ?? 'Sin dato');
                return `${item.marker || ''}${item.seriesName || ''}: ${value}`;
              });
              return [title, ...lines].filter(Boolean).join('\n');
            } },
      legend: { type: 'scroll', bottom: 0, textStyle: { color: chartTheme.textSecondary } },
      grid: { left: 75, right: 35, top: 45, bottom: 85 },
      xAxis, yAxis, series,
      visualMap: kind === 'heatmap' ? { min: Math.min(...heatValues), max: Math.max(...heatValues), calculable: true, orient: 'horizontal', top: 0, textStyle: { color: chartTheme.textSecondary }, inRange: { color: chartTheme.mode === 'dark' ? ['#233b57', '#73b7ff'] : ['#eff6ff', '#1d4ed8'] } } : [],
    }} /></Suspense>;
  }
  let traces: any[] = datasets.map((s, i) => ({
    name: s.label, x: kind === 'scatter' ? s.x : labels, y: s.data,
    type: ['bar', 'horizontal', 'stacked'].includes(renderKind) ? 'bar' : 'scatter',
    mode: kind === 'scatter' ? 'markers' : 'lines+markers',
    fill: kind === 'area' ? 'tozeroy' : undefined, customdata: s.data.map(value => formatDatasetValue(i, value)),
    hovertemplate: `<b>%{fullData.name}</b><br>${xLabel}: %{x}<br>${yLabel}: %{customdata}<extra></extra>`,
    marker: { color: chartTheme.colors[i % chartTheme.colors.length] }, connectgaps: false,
  }));
  if (kind === 'horizontal') traces = traces.map(t => ({ ...t, x: t.y, y: t.x, orientation: 'h',
    hovertemplate: `<b>%{fullData.name}</b><br>${xLabel}: %{y}<br>${yLabel}: %{customdata}<extra></extra>` }));
  if (pie) {
    const hole = kind === 'donut' ? .45 : 0;
    const hovertext = labels.map((label, index) => `${label}: ${pieDetails[index].value} (${pieDetails[index].percent})`);
    traces = [
      { type: 'pie', labels, values: pieValues, hole, marker: { colors: chartTheme.colors }, sort: false,
        textinfo: 'label', textposition: 'outside', hovertext, hovertemplate: '<b>%{hovertext}</b><extra></extra>' },
      { type: 'pie', labels, values: pieValues, hole, marker: { colors: pieValues.map(() => 'rgba(0,0,0,0)'), line: { width: 0 } }, sort: false,
        text: pieValues.map((_, index) => pieInnerText(index)), textinfo: 'text', textposition: 'inside',
        textfont: { color: chartTheme.mode === 'dark' ? '#10243b' : '#ffffff', size: 12 }, hovertext,
        hovertemplate: '<b>%{hovertext}</b><extra></extra>', showlegend: false },
    ];
  }
  if (kind === 'box') traces = datasets.map(s => {
    const a = s.data.filter((v): v is number => v !== null).sort((a, b) => a - b);
    return { type: 'box', name: s.label, q1: [quantile(a, .25)], median: [quantile(a, .5)], q3: [quantile(a, .75)], lowerfence: [a[0]], upperfence: [a[a.length - 1]], boxpoints: false };
  });
  if (kind === 'heatmap') traces = [{
    type: 'heatmap', x: labels, y: datasets.map(s => s.label), z: datasets.map(s => s.data),
    text: datasets.map((dataset, index) => dataset.data.map(value => formatDatasetValue(index, value))),
    hovertemplate: `${xLabel}: %{x}<br>%{y}<br>${yLabel}: %{text}<extra></extra>`,
    colorscale: chartTheme.mode === 'dark' ? [[0, '#12243a'], [1, '#73b7ff']] : 'Blues', hoverongaps: false,
  }];
  const valueAxisFormat = plotlyAxisFormat(kind === 'heatmap' ? '' : sharedFormat);
  return <Suspense fallback={<p>Cargando gráfico…</p>}><Plot data={traces} layout={{
    autosize: true, height: 450, margin: { l: 75, r: 35, b: 90, t: 35 },
    uirevision: `${widget.id}|${kind}|${xLabel}|${yLabel}`,
    font: { family: chartTheme.fontFamily, color: chartTheme.text },
    colorway: chartTheme.colors,
    paper_bgcolor: chartTheme.paper, plot_bgcolor: chartTheme.paper,
    hoverlabel: { bgcolor: chartTheme.tooltipBackground, bordercolor: chartTheme.border, font: { color: chartTheme.tooltipText } },
    xaxis: { title: { text: kind === 'horizontal' ? yLabel : xLabel, font: { color: chartTheme.textSecondary } }, tickfont: { color: chartTheme.textSecondary }, gridcolor: chartTheme.grid, linecolor: chartTheme.border, automargin: true, ...(kind === 'horizontal' ? valueAxisFormat : {}) },
    yaxis: { title: { text: kind === 'horizontal' ? xLabel : yLabel, font: { color: chartTheme.textSecondary } }, tickfont: { color: chartTheme.textSecondary }, gridcolor: chartTheme.grid, linecolor: chartTheme.border, automargin: true, ...(kind === 'horizontal' ? {} : valueAxisFormat) },
    barmode: kind === 'stacked' ? 'stack' : 'group', legend: { orientation: 'h', y: -0.25, font: { color: chartTheme.textSecondary } },
  }} config={{ responsive: true, displaylogo: false }} useResizeHandler style={{ width: '100%' }} /></Suspense>;
}
