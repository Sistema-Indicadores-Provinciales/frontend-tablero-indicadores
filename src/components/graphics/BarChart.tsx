import React from "react";
import ReactECharts from "echarts-for-react";
import { getLegendLayout } from "../../utils/charts/legendLayout";
import { ChartBaseProps } from './../../types/chartBaseProps';
import { sortSeries } from "utils/charts/seriesSort";
import { buildFormatter } from './../../utils/charts/numberFormat';
import { useChartTheme } from "utils/charts/chartTheme";

export interface BarSeries {
    name: string;
    x: (string | number)[];
    y: (number | null)[];
}

interface Props extends ChartBaseProps {
    series: BarSeries[];
    /** Apilar las barras. Default: false */
    stacked?: boolean;
}

const applySeriesLimit = (
    series: BarSeries[],
    maxSeries?: number,
    groupOthers?: boolean,
): BarSeries[] => {
    if (!maxSeries || series.length <= maxSeries) return series;
    const visible = series.slice(0, maxSeries - (groupOthers ? 1 : 0));
    if (!groupOthers) return visible;
    const rest = series.slice(maxSeries - 1);
    const othersY = visible[0]?.y.map((_, i) =>
        rest.reduce((acc, s) => acc + (s.y[i] ?? 0), 0)
    ) ?? [];
    return [...visible, { name: "Otros", x: visible[0]?.x ?? [], y: othersY }];
};

const applyPointsLimit = (series: BarSeries[], maxPoints?: number): BarSeries[] => {
    if (!maxPoints) return series;
    return series.map(s => ({
        ...s,
        x: s.x.slice(0, maxPoints),
        y: s.y.slice(0, maxPoints),
    }));
};

const BarChart: React.FC<Props> = ({
    // Datos
    series,
    xLabel = "",
    yLabel = "",
    seriesSortBy,
    seriesSortAgg = "sum",


    // Título
    title = "",
    showTitle = true,

    // Límites
    maxPoints,
    maxSeries,
    groupOthers = false,

    // Etiquetas
    showDataLabels = false,

    // Ejes
    yMin,
    yMax,
    invertY = false,
    showYTitle = true,
    showXTitle = true,

    // Formato de números
    numberFormat = "decimal",
    decimals,
    numberPrefix = "",
    numberSuffix = "",
    valueFormatter,

    // Leyenda
    showLegend,
    legendPosition = "bottom-center",

    // Estilo
    height = 400,
    backgroundColor,
    borderRadius = 8,
    showShadow = true,

    // Específico BarChart
    stacked = false,
}) => {
    const chartTheme = useChartTheme();
    if (!series?.length) return null;

    const processedSeries = sortSeries(
        applyPointsLimit(
            applySeriesLimit(series, maxSeries, groupOthers),
            maxPoints,
        ),
        seriesSortBy,
        seriesSortAgg,
    );

    const hasMultipleSeries = processedSeries.length > 1;
    const shouldShowLegend  = showLegend !== undefined ? showLegend : hasMultipleSeries;
    const hasTitle          = showTitle && Boolean(title);
    const xLabels           = processedSeries[0].x;

    const { legend, gridTop, gridBottom } = getLegendLayout(
        legendPosition,
        shouldShowLegend,
        hasTitle,
        chartTheme.textSecondary,
    );

    const format = buildFormatter({ numberFormat, decimals, numberPrefix, numberSuffix, valueFormatter });

    const chartBackground = backgroundColor ?? chartTheme.paper;
    const option = {
        backgroundColor: chartBackground,
        title: hasTitle ? {
            text: title,
            left: "center",
            top: 10,
            textStyle: {
                fontSize: 15,
                color: chartTheme.text,
                fontFamily: "IBM Plex Sans, sans-serif",
                fontWeight: 600,
            },
        } : undefined,
        tooltip: {
            trigger: "axis",
            backgroundColor: chartTheme.tooltipBackground,
            borderColor: chartTheme.border,
            textStyle: { color: chartTheme.tooltipText, fontSize: 12 },
            axisPointer: { type: "shadow" }, // solo en BarChart
            formatter: (params: any[]) => {
                const header = `<b>${params[0].axisValue}</b><br/>`;
                const lines = params
                    .filter(p => p.value != null)
                    .map(p =>
                        `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px;"></span>${p.seriesName}: <b>${format(p.value)}</b>`
                    )
                    .join("<br/>");
                return header + lines;
            },
        },
        legend,
        grid: {
            top:    gridTop,
            bottom: gridBottom,
            left:   70,
            right:  20,
            containLabel: false,
        },
        xAxis: {
            type: "category",
            data: xLabels,
            name: showXTitle ? xLabel : "",
            nameLocation: "middle",
            nameGap: shouldShowLegend && legendPosition.startsWith("bottom") ? 45 : 35,
            axisLabel: { rotate: -35, fontSize: 11, color: chartTheme.textSecondary },
            axisLine: { lineStyle: { color: chartTheme.border } },
            nameTextStyle: { color: chartTheme.textSecondary },
        },
        yAxis: {
            type: "value",
            name: showYTitle ? yLabel : "",
            nameLocation: "middle",
            nameGap: 55,
            inverse: invertY,
            min: yMin,
            max: yMax,
            axisLabel: {
                fontSize: 11,
                color: chartTheme.textSecondary,
                formatter: (val: number) => format(val),
            },
            splitLine: { lineStyle: { color: chartTheme.grid } },
            nameTextStyle: { color: chartTheme.textSecondary },
        },
        series: processedSeries.map((s, i) => ({
            name: s.name,
            type: "bar",
            data: s.y,
            stack: stacked ? "total" : undefined,
            itemStyle: {
                color: chartTheme.colors[i % chartTheme.colors.length],
                opacity: 0.92,
                borderRadius: stacked ? 0 : [3, 3, 0, 0],
            },
            label: {
                show: showDataLabels,
                color: chartTheme.text,
                position: stacked ? "inside" : "top",
                fontSize: 11,
                formatter: (p: any) => p.value != null ? format(p.value) : "",
            },
        })),
        color: chartTheme.colors,
    };

    return (
        <ReactECharts
            option={option}
            style={{
                width: "100%",
                height: `${height}px`,
                borderRadius: `${borderRadius}px`,
                boxShadow: showShadow ? chartTheme.shadow : "none",
                backgroundColor: chartBackground,
            }}
            replaceMerge={["series", "xAxis", "yAxis", "title"]}
            lazyUpdate
        />
    );
};

export default BarChart;
