import React from "react";
import Plot from "react-plotly.js";
import { useChartTheme } from "utils/charts/chartTheme";

export interface BarSeries {
    name: string;
    x: (string | number)[];
    y: (number | null)[];
}

interface Props {
    series: BarSeries[];
    xLabel?: string;
    yLabel?: string;
    title?: string;
    height?: number;
    stacked?: boolean;
}

const BarChartPlotly: React.FC<Props> = ({
    series,
    xLabel = "",
    yLabel = "",
    title = "",
    height = 400,
    stacked = false,
}) => {
    const chartTheme = useChartTheme();
    if (!series?.length) return null;

    const traces = series.map((s, i) => ({
        x: s.x,
        y: s.y,
        name: s.name,
        type: "bar" as const,
        marker: {
            color: chartTheme.colors[i % chartTheme.colors.length],
            opacity: 0.92,
        },
        hovertemplate: `<b>%{fullData.name}</b><br>${xLabel}: %{x}<br>${yLabel}: <b>%{y:,.2f}</b><extra></extra>`,
    }));

    const hasMultipleSeries = series.length > 1;

    return (
        <Plot
            data={traces}
            layout={{
                title: { text: title, font: { size: 16, color: chartTheme.text } },
                font: { family: chartTheme.fontFamily, color: chartTheme.text },
                uirevision: `${title}|${xLabel}|${yLabel}|${series.map(s => s.name).join('|')}`,
                xaxis: {
                    title: { text: xLabel, font: { size: 13, color: chartTheme.textSecondary } },
                    tickfont: { color: chartTheme.textSecondary },
                    tickangle: -35,
                    gridcolor: chartTheme.grid,
                    linecolor: chartTheme.border,
                },
                yaxis: {
                    title: { text: yLabel, font: { size: 13, color: chartTheme.textSecondary } },
                    tickfont: { color: chartTheme.textSecondary },
                    gridcolor: chartTheme.grid,
                    linecolor: chartTheme.border,
                    tickformat: ",~f",
                },
                barmode: stacked ? "stack" : "group",
                bargap: 0.18,
                bargroupgap: 0.05,
                legend: hasMultipleSeries ? {
                    orientation: "h",
                    y: -0.25,
                    x: 0,
                    font: { size: 11, color: chartTheme.textSecondary },
                    bgcolor: "rgba(0,0,0,0)",
                } : undefined,
                showlegend: hasMultipleSeries,
                plot_bgcolor: chartTheme.paper,
                paper_bgcolor: chartTheme.paper,
                margin: { t: 60, b: hasMultipleSeries ? 110 : 70, l: 70, r: 20 },
                hovermode: "x unified",
                hoverlabel: {
                    bgcolor: chartTheme.tooltipBackground,
                    bordercolor: chartTheme.border,
                    font: { family: chartTheme.fontFamily, size: 12, color: chartTheme.tooltipText },
                    align: "left",
                    namelength: -1,
                },
            }}
            config={{
                responsive: true,
                displaylogo: false,
                displayModeBar: true,
                modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"],
                toImageButtonOptions: {
                    format: "png",
                    filename: title || "grafico",
                    scale: 2,
                },
            }}
            style={{ width: "100%", height: `${height}px` }}
        />
    );
};

export default BarChartPlotly;
