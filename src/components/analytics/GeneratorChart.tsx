import { ComponentProps, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type EChartsReact from 'echarts-for-react';
import { ChartConfig, ChartData, ColumnAliases, Scalar, Widget } from 'types/Generator';
import { useChartTheme } from 'utils/charts/chartTheme';
import { columnLabel } from 'utils/generatorConfig';
import { chartNumberText, indicatorFormatField, plotlyNumberAxis, seriesNumberText } from 'utils/chartNumbers';
const Plot = lazy(() => import('react-plotly.js'));
const ECharts = lazy(() => import('echarts-for-react'));
const MapsChart = lazy(() => import('components/graphics/MapsChart'));
const LocationMap = lazy(() => import('./LocationMap'));
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
const mapValue = (value: Scalar) => value == null ? 'Sin dato'
  : typeof value === 'number' ? value.toLocaleString('es-AR')
  : typeof value === 'boolean' ? value ? 'Sí' : 'No' : String(value);
const chartNumber = (value: number | null) => value == null ? 'Sin dato'
  : value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const chartPercent = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`;
function ChartTable({ result, aliases, formats }: { result: ChartData; aliases?: ColumnAliases; formats?: ChartConfig['number_formats'] }) {
  const [page, setPage] = useState(0);
  const records = result.records || [], size = 100;
  useEffect(() => setPage(0), [result.records]);
  const current = Math.min(page, Math.max(0, Math.ceil(records.length / size) - 1));
  const start = current * size;
  return <><div className="generator-table"><table><thead><tr>{result.columns?.map(c => <th key={c}>{columnLabel(c, aliases)}</th>)}</tr></thead>
    <tbody>{records.slice(start, start + size).map((row, i) => <tr key={start + i}>{result.columns?.map(c => <td key={c}>{chartNumberText(row[c], formats?.[c]) ?? mapValue(row[c])}</td>)}</tr>)}</tbody></table></div>
    <div className="generator-controls" aria-label="Paginación de tabla"><span>{records.length ? start + 1 : 0}–{Math.min(start + size, records.length)} de {records.length.toLocaleString('es-AR')}</span>
      <button type="button" disabled={!current} onClick={() => setPage(current - 1)}>Anterior</button>
      <button type="button" disabled={start + size >= records.length} onClick={() => setPage(current + 1)}>Siguiente</button>
    </div></>;
}
export default function GeneratorChart({ widget, result, showIndicatorTitle = true, aliases }: {
  widget: Widget; result: ChartData; showIndicatorTitle?: boolean; aliases?: ColumnAliases;
}) {
  const chartTheme = useChartTheme();
  const kind = widget.config.chart_type;
  const formats = widget.config.number_formats;
  const percentage = widget.config.value_format === 'percent' || widget.config.value_format === 'percent_points';
  const percentPoints = widget.config.value_format === 'percent_points';
  const metricValue = (value: number | null) => value == null ? 'Sin dato' : percentage ? chartPercent(value * (percentPoints ? 1 : 100)) : chartNumber(value);
  if (kind === 'table') return <ChartTable result={result} aliases={aliases} formats={formats} />;
  if (kind === 'map') {
    if (widget.config.map_lookup) return <>
      <Suspense fallback={<p>Cargando mapa…</p>}><LocationMap widget={widget} result={result} aliases={aliases} /></Suspense>
      <details className="generator-map-details"><summary>Ver detalle por ubicación</summary><ChartTable result={result} aliases={aliases} formats={formats} /></details>
    </>;
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
      {!!point.metrics?.length && <dl>{point.metrics.map(metric => <div key={metric.field}><dt>{columnLabel(metric.field, aliases)}</dt><dd>{chartNumberText(metric.value, formats?.[metric.field]) ?? mapValue(metric.value)}</dd></div>)}</dl>}
    </div>;
    const markers = points.map(point => ({ id: point.id, position: { lat: point.lat, lng: point.lng }, title: point.label, data: point, infoContent: info(point) }));
    const circles = points.map(point => ({ id: point.id, center: { lat: point.lat, lng: point.lng }, radius: radius(point.value), options: {
      fillColor: chartTheme.colors[0], fillOpacity: .32, strokeColor: chartTheme.colors[0], strokeOpacity: .8, strokeWeight: 1,
    }, data: point, infoContent: info(point) }));
    return <Suspense fallback={<p>Cargando mapa…</p>}><div className="generator-map"><MapsChart height="450px"
      displayMode={widget.config.map_mode || 'markers'} markers={markers} circles={circles} fitBounds highlightFormosa /></div></Suspense>;
  }
  if (kind === 'indicator' && widget.config.indicator_text_column) {
    return <div className="generator-indicator"><strong>{result.indicator_text ?? 'Sin datos'}</strong>{showIndicatorTitle && <span>{widget.title}</span>}</div>;
  }
  if (kind === 'indicator') {
    const value = result.datasets[0]?.data[0] ?? (widget.config.indicator_empty === 'zero' ? 0 : null);
    const decimals = widget.config.indicator_decimals;
    const formatted = value == null ? undefined : percentage ? metricValue(value) : value.toLocaleString('es-AR', decimals == null ? undefined : { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const explicit = chartNumberText(value, formats?.[indicatorFormatField(widget.config)]);
    return <div className="generator-indicator"><strong>{explicit ?? (formatted == null ? 'Sin datos' : `${formatted}${widget.config.indicator_suffix || ''}`)}</strong>{showIndicatorTitle && <span>{widget.title}</span>}</div>;
  }
  if (!result.datasets.length) return <p>No hay datos para los filtros seleccionados.</p>;
  let labels = result.labels.map(v => v == null ? 'Sin dato' : v);
  const groupField = widget.config.group_col || (kind === 'box' ? widget.config.x_col : '');
  const groupFormat = formats?.[groupField];
  const categoryFormat = kind === 'histogram' || kind === 'box' ? undefined : formats?.[widget.config.x_col];
  const categoryText = (value: Scalar | undefined) => chartNumberText(value, categoryFormat) ?? String(value ?? 'Sin dato');
  let datasets = result.datasets.map(dataset => {
    const metric = dataset.metric ? columnLabel(dataset.metric, aliases) : '';
    const label = metric ? metric + (dataset.group !== undefined ? ' · ' + dataset.group : '')
      : !groupField && kind !== 'box' ? columnLabel(dataset.label, aliases) : dataset.label;
    const displayName = dataset.group !== undefined ? metric + ' · ' + seriesNumberText(dataset.group, groupFormat)
      : groupField && !dataset.metric ? seriesNumberText(label, groupFormat) : label;
    return { ...dataset, label, displayName };
  });
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
      return { label: s.label, displayName: s.displayName, data };
    });
    renderKind = 'bar';
  }
  const xLabel = columnLabel(kind === 'histogram' ? widget.config.y_col : widget.config.x_col, aliases);
  const barLabelMode = ['bar', 'horizontal', 'stacked'].includes(kind) ? widget.config.bar_label_mode : undefined;
  const labelMetric = barLabelMode === 'second_metric' ? widget.config.y_cols?.[0] : undefined;
  const labelOnlySeries = new Map(datasets.filter(dataset => labelMetric && dataset.metric === labelMetric).map(dataset => [dataset.group, dataset]));
  if (labelOnlySeries.size) datasets = datasets.filter(dataset => dataset.metric !== labelMetric);
  const renderedMetrics = new Set(datasets.flatMap(dataset => dataset.metric ? [dataset.metric] : []));
  const yLabel = kind === 'histogram' || widget.config.aggregation === 'count'
    ? 'Registros'
    : widget.config.metric_ratio ? widget.config.metric_ratio.subtract_denominator ? 'Variación (%)' : 'Cociente' : renderedMetrics.size > 1 ? 'Valores' : columnLabel(widget.config.y_col, aliases);
  const pie = kind === 'pie' || kind === 'donut';
  const metricFormats = datasets.map(dataset => kind === 'histogram' ? undefined : formats?.[dataset.metric || widget.config.y_col]);
  const valueFormat = metricFormats[0];
  const sharedValueFormat = valueFormat && metricFormats.every(format => format?.style === valueFormat.style
    && format.digits === valueFormat.digits && format.group_digits === valueFormat.group_digits) ? valueFormat : undefined;
  const categories = new Map(labels.map(label => [String(label), categoryText(label)]));
  const seriesLabels = new Map(datasets.map(series => [series.label, series.displayName]));
  const stackTotals = barLabelMode === 'percent_of_stack'
    ? labels.map((_, index) => datasets.reduce((total, series) => total + (series.data[index] ?? 0), 0))
    : [];
  const barLabels = barLabelMode ? datasets.map((dataset, seriesIndex) => {
    const labelValues = labelOnlySeries.get(dataset.group)?.data;
    return dataset.data.map((value, index) => {
      if (value == null) return '';
      if (barLabelMode === 'second_metric') {
        const label = dataset.metric === widget.config.y_col ? labelValues?.[index] : null;
        return label == null ? '' : chartNumberText(label, labelMetric ? formats?.[labelMetric] : undefined) ?? chartNumber(label);
      }
      if (barLabelMode === 'percent_of_stack') {
        return stackTotals[index] && value ? chartPercent(value / stackTotals[index] * 100) : '';
      }
      return chartNumberText(value, metricFormats[seriesIndex]) ?? metricValue(value);
    });
  }) : [];
  const pieLabelMode = widget.config.pie_label_mode || 'percent';
  const pieValues = pie ? datasets[0].data : [];
  const pieTotal = pieValues.reduce<number>((total, value) => total + (value || 0), 0);
  const pieDetails = pieValues.map(value => ({
    value: chartNumberText(value, valueFormat) ?? chartNumber(value),
    percent: chartPercent(pieTotal && value != null ? value / pieTotal * 100 : 0),
  }));
  const pieInnerText = (index: number) => !pieValues[index] ? ''
    : pieLabelMode === 'value' ? pieDetails[index].value : pieDetails[index].percent;
  if (widget.library === 'ECharts') {
    let series: any[] = datasets.map((s, index) => ({
      id: `series:${s.label}`, name: s.label,
      type: ['bar', 'horizontal', 'stacked'].includes(renderKind) ? 'bar' : renderKind === 'scatter' ? 'scatter' : 'line',
      data: renderKind === 'scatter' ? s.data.map((v, i) => [s.x?.[i], v]) : s.data.map((value, i) => ({ name: String(labels[i]), value })),
      stack: kind === 'stacked' ? 'total' : undefined,
      label: barLabels[index] ? { show: true, position: barLabelMode === 'percent_of_stack' ? 'inside' : kind === 'horizontal' ? 'right' : 'top',
        color: barLabelMode === 'percent_of_stack' ? undefined : chartTheme.text,
        formatter: ({ dataIndex }: { dataIndex: number }) => barLabels[index][dataIndex] } : undefined,
      areaStyle: kind === 'area' ? {} : undefined, connectNulls: false, universalTransition: true,
      tooltip: metricFormats[index] ? { valueFormatter: (value: number) => chartNumberText(value, metricFormats[index]) ?? metricValue(value) } : undefined,
    }));
    const axisStyle = {
      axisLabel: { color: chartTheme.textSecondary },
      axisLine: { lineStyle: { color: chartTheme.border } },
      splitLine: { lineStyle: { color: chartTheme.grid } },
      nameTextStyle: { color: chartTheme.textSecondary },
    };
    const formatCategoryTick = (value: Scalar) => categories.get(String(value)) ?? categoryText(value);
    const formatSeriesTick = (value: string) => seriesLabels.get(value) ?? value;
    let xAxis: any = { ...axisStyle, type: kind === 'scatter' ? 'value' : 'category', data: labels, name: xLabel,
      axisLabel: { ...axisStyle.axisLabel, hideOverlap: true, formatter: categoryFormat ? formatCategoryTick : undefined } };
    let yAxis: any = { ...axisStyle, type: 'value', name: yLabel, axisLabel: { ...axisStyle.axisLabel,
      formatter: sharedValueFormat ? (value: number) => chartNumberText(value, sharedValueFormat) ?? metricValue(value) : percentage ? metricValue : undefined } };
    if (kind === 'horizontal') [xAxis, yAxis] = [yAxis, xAxis];
    if (pie) {
      const radius = kind === 'donut' ? ['40%', '65%'] : '65%';
      const data = labels.map((name, i) => ({ id: String(name), name: String(name), value: pieValues[i] }));
      series = [
        { id: 'series:pie', type: 'pie', radius, universalTransition: true, data,
          label: { show: true, position: 'outside', formatter: categoryFormat ? (params: { name: string }) => formatCategoryTick(params.name) : '{b}' }, labelLine: { show: true } },
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
      xAxis = { ...axisStyle, type: 'category', data: datasets.map(s => s.label),
        axisLabel: { ...axisStyle.axisLabel, formatter: groupFormat ? formatSeriesTick : undefined } };
    }
    const heatValues = datasets.flatMap(s => s.data.filter((v): v is number => v !== null));
    const formatHeatTooltip = (params: { value: [number, number, number] }) => {
      const [column, row, value] = params.value;
      return `${datasets[row].displayName} · ${categoryText(labels[column])}: ${chartNumberText(value, metricFormats[row]) ?? metricValue(value)}`;
    };
    if (kind === 'heatmap') {
      yAxis = { ...axisStyle, type: 'category', data: datasets.map(s => s.label),
        axisLabel: { ...axisStyle.axisLabel, formatter: groupFormat ? formatSeriesTick : undefined } };
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
        valueFormatter: percentage ? metricValue : undefined,
        formatter: pie ? (params: any) => `${params.marker}${formatCategoryTick(params.name)}: ${chartNumberText(params.value, valueFormat) ?? metricValue(params.value)} (${chartPercent(params.percent)})`
          : kind === 'heatmap' && (groupFormat || categoryFormat || metricFormats.some(Boolean)) ? formatHeatTooltip : undefined },
      legend: { type: 'scroll', bottom: 0, textStyle: { color: chartTheme.textSecondary },
        formatter: pie && categoryFormat ? formatCategoryTick : groupFormat ? formatSeriesTick : undefined },
      grid: { left: 75, right: 35, top: 45, bottom: 85 },
      xAxis, yAxis, series,
      visualMap: kind === 'heatmap' ? { min: Math.min(...heatValues), max: Math.max(...heatValues), calculable: true, orient: 'horizontal', top: 0, textStyle: { color: chartTheme.textSecondary }, inRange: { color: chartTheme.mode === 'dark' ? ['#233b57', '#73b7ff'] : ['#eff6ff', '#1d4ed8'] } } : [],
    }} /></Suspense>;
  }
  let traces: any[] = datasets.map((s, index) => {
    const x = kind === 'scatter' ? s.x : labels;
    const format = metricFormats[index];
    const customHover = !!(format || categoryFormat);
    const percentageAxis = kind === 'horizontal' ? 'x' : 'y';
    const categoryAxis = kind === 'horizontal' ? 'y' : 'x';
    return {
      name: s.displayName, uid: groupFormat ? s.label : undefined, x, y: s.data,
      type: ['bar', 'horizontal', 'stacked'].includes(renderKind) ? 'bar' : 'scatter',
      text: barLabels[index],
      textposition: barLabels[index] ? barLabelMode === 'percent_of_stack' ? 'inside' : 'outside' : undefined,
      mode: kind === 'scatter' ? 'markers' : 'lines+markers',
      fill: kind === 'area' ? 'tozeroy' : undefined,
      marker: { color: chartTheme.colors[index % chartTheme.colors.length] }, connectgaps: false,
      customdata: customHover ? s.data.map((value, i) => [categoryText(x?.[i]), chartNumberText(value, format) ?? metricValue(value)]) : undefined,
      hovertemplate: customHover ? '%{customdata[0]}: %{customdata[1]}<extra>%{fullData.name}</extra>'
        : percentage ? `%{${categoryAxis}}: %{${percentageAxis}:${percentPoints ? '.2f' : '.2%'}}${percentPoints ? '%' : ''}<extra>%{fullData.name}</extra>` : undefined,
    };
  });
  if (kind === 'horizontal') traces = traces.map(t => ({ ...t, x: t.y, y: t.x, orientation: 'h' }));
  if (pie) {
    const hole = kind === 'donut' ? .45 : 0;
    const hovertext = labels.map((label, index) => `${categoryText(label)}: ${pieDetails[index].value} (${pieDetails[index].percent})`);
    const displayLabels = categoryFormat ? labels.map(categoryText) : labels;
    // Plotly groups pie data by its label, including labels that round to the same number.
    const pieLabels = new Set(displayLabels).size === labels.length ? displayLabels : labels;
    traces = [
      { type: 'pie', labels: pieLabels, values: pieValues, hole, marker: { colors: chartTheme.colors }, sort: false,
        textinfo: 'label', textposition: 'outside', hovertext, hovertemplate: '<b>%{hovertext}</b><extra></extra>' },
      { type: 'pie', labels: pieLabels, values: pieValues, hole, marker: { colors: pieValues.map(() => 'rgba(0,0,0,0)'), line: { width: 0 } }, sort: false,
        text: pieValues.map((_, index) => pieInnerText(index)), textinfo: 'text', textposition: 'inside',
        textfont: { color: chartTheme.mode === 'dark' ? '#10243b' : '#ffffff', size: 12 }, hovertext,
        hovertemplate: '<b>%{hovertext}</b><extra></extra>', showlegend: false },
    ];
  }
  if (kind === 'box') traces = datasets.map(s => {
    const a = s.data.filter((v): v is number => v !== null).sort((a, b) => a - b);
    return { type: 'box', name: s.displayName, x: groupFormat ? [s.label] : undefined, q1: [quantile(a, .25)], median: [quantile(a, .5)], q3: [quantile(a, .75)], lowerfence: [a[0]], upperfence: [a[a.length - 1]], boxpoints: false };
  });
  if (kind === 'heatmap') {
    const customHover = !!(groupFormat || categoryFormat || metricFormats.some(Boolean));
    traces = [{
      type: 'heatmap', x: labels, y: datasets.map(s => s.label), z: datasets.map(s => s.data),
      colorscale: chartTheme.mode === 'dark' ? [[0, '#12243a'], [1, '#73b7ff']] : 'Blues', hoverongaps: false,
      customdata: customHover ? datasets.map((s, row) => s.data.map((value, col) =>
        [s.displayName, categoryText(labels[col]), chartNumberText(value, metricFormats[row]) ?? metricValue(value)])) : undefined,
      hovertemplate: customHover ? '%{customdata[0]} · %{customdata[1]}: %{customdata[2]}<extra></extra>' : undefined,
    }];
  }
  const categoryTicks = kind === 'box' && groupFormat ? { tickvals: datasets.map(s => s.label), ticktext: datasets.map(s => s.displayName) }
    : categoryFormat && labels.length ? { tickvals: labels, ticktext: labels.map(categoryText) } : {};
  const categoryOptions = kind === 'scatter' && categoryFormat ? plotlyNumberAxis(categoryFormat) : categoryTicks;
  const valueOptions = sharedValueFormat && kind !== 'heatmap' ? plotlyNumberAxis(sharedValueFormat) : {
    tickformat: percentage ? percentPoints ? '.0f' : '.0%' : undefined,
    ticksuffix: percentPoints ? '%' : undefined,
  };
  const groupTicks = { tickvals: datasets.map(s => s.label), ticktext: datasets.map(s => s.displayName) };
  return <Suspense fallback={<p>Cargando gráfico…</p>}><Plot data={traces} layout={{
    autosize: true, height: 450, margin: { l: 75, r: 35, b: 90, t: 35 },
    uirevision: `${widget.id}|${kind}|${xLabel}|${yLabel}`,
    font: { family: chartTheme.fontFamily, color: chartTheme.text },
    colorway: chartTheme.colors,
    separators: (sharedValueFormat || (kind === 'scatter' && categoryFormat)) ? ',.' : undefined,
    paper_bgcolor: chartTheme.paper, plot_bgcolor: chartTheme.paper,
    hoverlabel: { bgcolor: chartTheme.tooltipBackground, bordercolor: chartTheme.border, font: { color: chartTheme.tooltipText } },
    xaxis: { title: { text: kind === 'horizontal' ? yLabel : xLabel, font: { color: chartTheme.textSecondary } }, tickfont: { color: chartTheme.textSecondary }, gridcolor: chartTheme.grid, linecolor: chartTheme.border, automargin: true, ...(kind === 'horizontal' ? valueOptions : categoryOptions) },
    yaxis: { title: { text: kind === 'horizontal' ? xLabel : yLabel, font: { color: chartTheme.textSecondary } }, tickfont: { color: chartTheme.textSecondary }, gridcolor: chartTheme.grid, linecolor: chartTheme.border, automargin: true, ...(kind === 'horizontal' ? categoryOptions : valueOptions), ...(kind === 'heatmap' && groupFormat ? groupTicks : {}) },
    barmode: kind === 'stacked' ? 'stack' : 'group', legend: { orientation: 'h', y: -0.25, font: { color: chartTheme.textSecondary } },
  }} config={{ responsive: true, displaylogo: false }} useResizeHandler style={{ width: '100%' }} /></Suspense>;
}
