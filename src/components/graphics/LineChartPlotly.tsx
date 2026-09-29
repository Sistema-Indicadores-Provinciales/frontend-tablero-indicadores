// src/components/graphics/LineChart.tsx
import React from "react";
import Plot from "react-plotly.js";
import { useChartTheme } from "utils/charts/chartTheme";

interface Series {
    name: string;
    x: (string | number)[];
    y: (number | null)[];
}

interface Props {
    series: Series[];
    xLabel?: string;
    yLabel?: string;
    title?: string;
    height?: number;
}

const LineChartPlotly: React.FC<Props> = ({
    series,
    xLabel = "",
    yLabel = "",
    title = "",
    height = 400,
}) => {
    const chartTheme = useChartTheme();
    if (!series?.length) return null;

    const traces = series.map((s, i) => ({
        x: s.x,
        y: s.y,
        name: s.name,
        type: "scatter" as const,
        mode: "lines+markers" as const,
        line: { color: chartTheme.colors[i % chartTheme.colors.length], width: 2.5 },
        marker: { color: chartTheme.colors[i % chartTheme.colors.length], size: 6 },
    }));

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
                legend: {
                    orientation: "h",
                    y: -0.25,
                    x: 0,
                    font: { color: chartTheme.textSecondary },
                },
                plot_bgcolor: chartTheme.paper,
                paper_bgcolor: chartTheme.paper,
                margin: { t: 60, b: 100, l: 70, r: 20 },
                hovermode: "x unified",
                hoverlabel: { bgcolor: chartTheme.tooltipBackground, bordercolor: chartTheme.border, font: { color: chartTheme.tooltipText } },
            }}
            config={{
                responsive: true,
                displaylogo: false,
            }}
            style={{ width: "100%", height: `${height}px` }}
        />
    );
};

export default LineChartPlotly;
