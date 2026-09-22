// src/components/graphics/PieChart.tsx
import React, { useEffect, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { getLegendLayout } from "../../utils/charts/legendLayout";
import { buildFormatter } from "utils/charts/numberFormat";
import { ChartBaseProps } from "../../types/chartBaseProps";

const PALETTE = [
    "#2563eb", "#e11d48", "#f97316", "#16a34a",
    "#9333ea", "#0891b2", "#ca8a04", "#be123c",
    "#15803d", "#7c3aed", "#0284c7", "#dc2626",
];
// Mismo array que LineChart.tsx, duplicado acá porque no está centralizado.
// Si en algún momento se extrae a utils/charts/palette.ts, actualizar ambos.

const LEGEND_FONT_FAMILY = "IBM Plex Sans, sans-serif";
const PIE_LEGEND_GAP = 35;
const PIE_LEGEND_OUTER_MARGIN = 35;
const PIE_LEGEND_MIN_TEXT_WIDTH = 80;
const PIE_LEGEND_RIGHT_MARGIN = 8;
const PIE_LEGEND_ICON_WIDTH = 12;
// ECharts ubica el texto 5 px después del ícono de 12 px.
const PIE_LEGEND_ICON_TEXT_OFFSET = PIE_LEGEND_ICON_WIDTH + 5;

interface PieChartDatum {
    name: string;
    value: number;
}

interface Props
    extends Omit<
        ChartBaseProps,
        | "xLabel"
        | "yLabel"
        | "maxPoints"
        | "yMin"
        | "yMax"
        | "invertY"
        | "showYTitle"
        | "showXTitle"
        | "seriesSortBy"
        | "seriesSortAgg"
    > {
    data: PieChartDatum[];

    /** Radio interno (0 = torta sólida, >0 = dona). Porcentaje 0-100. Default: 0 */
    innerRadius?: number;
    /** Radio externo. Porcentaje 0-100. Default: 70 */
    outerRadius?: number;

    /** Tamaño de fuente del valor dentro de cada porción en px. Default: 12 */
    valueFontSize?: number;
    /** Color del texto del valor dentro de cada porción. Default: "#ffffff" */
    valueColor?: string;

    /** Tamaño de fuente de la leyenda en px (ChartBaseProps/legendLayout no lo expone). Default: 11 */
    legendFontSize?: number;
}

// Factor aproximado de ancho promedio de un carácter respecto al font-size,
// para estimar en px si el texto del valor entra dentro de la porción.
const AVG_CHAR_WIDTH_FACTOR = 0.62;
const FIT_SAFETY_MARGIN = 1.15;

// maxSeries/groupOthers vienen de ChartBaseProps; acá "series" = "porciones".
const applySliceLimit = (
    data: PieChartDatum[],
    maxSeries?: number,
    groupOthers?: boolean,
): PieChartDatum[] => {
    if (!maxSeries || data.length <= maxSeries) return data;

    const sorted = [...data].sort((a, b) => b.value - a.value);
    const visible = sorted.slice(0, maxSeries - (groupOthers ? 1 : 0));

    if (!groupOthers) return visible;

    const rest = sorted.slice(maxSeries - 1);
    const othersValue = rest.reduce((acc, d) => acc + d.value, 0);

    return [...visible, { name: "Otros", value: othersValue }];
};

const PieChart: React.FC<Props> = ({
    data,

    title = "",
    showTitle = true,

    innerRadius = 0,
    outerRadius = 70,

    maxSeries,
    // Default true (a diferencia de LineChart, que es false): para Pie,
    // agrupar el resto en "Otros" es el comportamiento esperado por defecto.
    groupOthers = true,

    showDataLabels = true,
    valueFontSize = 12,
    valueColor = "#ffffff",

    numberFormat = "decimal",
    decimals,
    numberPrefix,
    numberSuffix,
    valueFormatter,

    showLegend,
    legendPosition = "bottom-center",
    legendFontSize = 11,

    height = 400,
    backgroundColor = "#ffffff",
    borderRadius = 8,
    showShadow = true,
}) => {
    // Medimos el ancho real del contenedor (el alto ya lo sabemos por `height`)
    // para calcular en px si el valor de cada porción entra dentro de su ancho.
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        if (!wrapperRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            setContainerWidth(entry.contentRect.width);
        });
        observer.observe(wrapperRef.current);
        return () => observer.disconnect();
    }, []);

    if (!data?.length) return null;

    const groupedData = applySliceLimit(data, maxSeries, groupOthers);
    const total = groupedData.reduce((acc, d) => acc + d.value, 0);

    const hasTitle = showTitle && Boolean(title);
    const shouldShowLegend = showLegend !== undefined ? showLegend : groupedData.length > 1;

    const { legend, gridTop, gridBottom } = getLegendLayout(
        legendPosition,
        shouldShowLegend,
        hasTitle,
    );

    const format = buildFormatter({ numberFormat, decimals, numberPrefix, numberSuffix, valueFormatter });

    const formatValue = (raw: number): string => {
        if (numberFormat === "percent" || numberFormat === "percent-decimal") {
            return format(total > 0 ? raw / total : 0);
        }
        return format(raw);
    };

    // Reservamos el mismo espacio vertical que LineChart/BarChart le dan a
    // título + leyenda (gridTop/gridBottom son los mismos px que usan para
    // el grid cartesiano), y centramos la torta en el espacio restante.
    const drawableHeight = Math.max(height - gridTop - gridBottom, 0);

    const centerY = `${(
      ((gridTop + drawableHeight / 2) / height) *
      100
    ).toFixed(2)}%`;

    const isSideLegend =
        shouldShowLegend &&
        (legendPosition === "left" || legendPosition === "right");

    const SIDE_LEGEND_ROW_HEIGHT = 20;
    const SIDE_LEGEND_SCROLL_PADDING = 8;

    const sideLegendHeight = isSideLegend
    ? Math.min(
        drawableHeight,
        groupedData.length * SIDE_LEGEND_ROW_HEIGHT +
            SIDE_LEGEND_SCROLL_PADDING,
        )
    : undefined;

    const sideLegendTop =
    sideLegendHeight !== undefined
        ? gridTop + (drawableHeight - sideLegendHeight) / 2
        : undefined;

    // La torta y la leyenda usan las mismas coordenadas y el mismo radio real.
    // El ancho de las etiquetas ya no desplaza la leyenda entre gráficos.
    const sideLegendLayout = (() => {
        if (!isSideLegend || !containerWidth) {
            return undefined;
        }

        const heightLimitedRadius = drawableHeight * outerRadius / 200;
        const widthLimitedRadius = Math.max(
            (containerWidth - 2 * PIE_LEGEND_OUTER_MARGIN - PIE_LEGEND_GAP - PIE_LEGEND_MIN_TEXT_WIDTH) / 2,
            0,
        );
        const outerPx = Math.min(heightLimitedRadius, widthLimitedRadius);
        const innerPx = outerRadius > 0 ? outerPx * innerRadius / outerRadius : 0;
        const isRight = legendPosition === "right";
        const pieCenterXPx = isRight
            ? PIE_LEGEND_OUTER_MARGIN + outerPx
            : containerWidth - PIE_LEGEND_OUTER_MARGIN - outerPx;
        // El inicio visible del ítem (su ícono) queda a la misma distancia
        // de la torta que el borde izquierdo de la torta queda del contenedor.
        const rightLegendLeft = pieCenterXPx + outerPx + PIE_LEGEND_GAP;
        const left = isRight ? rightLegendLeft : undefined;
        const textWidth = isRight
            ? Math.max(containerWidth - rightLegendLeft - PIE_LEGEND_ICON_TEXT_OFFSET - PIE_LEGEND_RIGHT_MARGIN, 0)
            : Math.max(containerWidth - 2 * PIE_LEGEND_OUTER_MARGIN - 2 * outerPx - PIE_LEGEND_GAP, 0);
        // En la leyenda izquierda ECharts alinea el bloque por su contenido
        // real; anclarlo desde la derecha mantiene fija la distancia al gráfico.
        const right = isRight
            ? undefined
            : containerWidth - (pieCenterXPx - outerPx - PIE_LEGEND_GAP + PIE_LEGEND_ICON_TEXT_OFFSET);

        return {
            centerX: pieCenterXPx,
            innerPx,
            outerPx,
            left,
            right,
            width: textWidth + PIE_LEGEND_ICON_TEXT_OFFSET,
            textWidth,
        };
    })();

    const baseRadiusPx = Math.min(containerWidth, drawableHeight) / 2;
    const outerPx = sideLegendLayout?.outerPx ?? baseRadiusPx * (outerRadius / 100);
    const innerPx = sideLegendLayout?.innerPx ?? baseRadiusPx * (innerRadius / 100);
    const labelRadiusPx = (outerPx + innerPx) / 2;

    const visibleLabels = groupedData.map((d) => {
        if (!containerWidth || total === 0) return true; // aún no medido: se corrige en el próximo render
        const angle = (d.value / total) * 2 * Math.PI;
        // En porciones mayores a media torta, sus bordes vuelven a acercarse,
        // pero el área interior disponible continúa siendo amplia.
        const fitAngle = Math.min(angle, Math.PI);
        const availableWidthPx = 2 * labelRadiusPx * Math.sin(fitAngle / 2);
        const textWidthPx =
            formatValue(d.value).length * valueFontSize * AVG_CHAR_WIDTH_FACTOR * FIT_SAFETY_MARGIN;
        return availableWidthPx >= textWidthPx;
    });

    const option = {
        backgroundColor,
        title: hasTitle ? {
            text: title,
            left: "center",
            top: 10,
            textStyle: {
                fontSize: 15,
                color: "#1e293b",
                fontFamily: "IBM Plex Sans, sans-serif",
                fontWeight: 600,
            },
        } : undefined,
        tooltip: {
            trigger: "item",
            renderMode: "html",
            appendTo: "body",
            confine: true,
            backgroundColor: "#1e293b",
            borderColor: "#334155",
            textStyle: { color: "#f8fafc", fontSize: 12 },
            formatter: (params: any) =>
                `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${params.color};margin-right:6px;"></span>${params.name}: <b>${formatValue(params.value)}</b> (${params.percent}%)`,
        },
        legend: {
            ...legend,
            ...(isSideLegend
                ? {
                    top: sideLegendTop,
                    bottom: undefined,
                    height: sideLegendHeight,
                    left: sideLegendLayout?.left,
                    right: sideLegendLayout?.right,
                    width: sideLegendLayout?.width,
                    padding: 0,
                    align: legendPosition === "right" ? "left" : "right",
                    itemWidth: PIE_LEGEND_ICON_WIDTH,
                    }
                : {}),
            textStyle: {
                ...(legend as Record<string, unknown>).textStyle as object,
                fontSize: legendFontSize,
                fontFamily: LEGEND_FONT_FAMILY,
                // La caja transparente hace que el scroll reserve todo el ancho del texto.
                ...(isSideLegend ? { width: sideLegendLayout?.textWidth, backgroundColor: "transparent" } : {}),
            },
        },
        series: [{
            type: "pie",
            radius: sideLegendLayout
                ? [sideLegendLayout.innerPx, sideLegendLayout.outerPx]
                : [`${innerRadius}%`, `${outerRadius}%`],
            center: [sideLegendLayout?.centerX ?? "50%", centerY],
            itemStyle: {
                borderColor: backgroundColor,
                borderWidth: 2,
            },
            label: {
                show: showDataLabels,
                position: "inside",
                fontSize: valueFontSize,
                color: valueColor,
                fontWeight: 600,
                formatter: (params: any) =>
                    visibleLabels[params.dataIndex] ? formatValue(params.value) : "",
            },
            labelLine: { show: false },
            data: groupedData.map((d) => ({ name: d.name, value: d.value })),
        }],
        color: PALETTE,
    };

    return (
        <div
            ref={wrapperRef}
            style={{
                width: "100%",
                height: `${height}px`,
                borderRadius: `${borderRadius}px`,
                boxShadow: showShadow ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                overflow: "hidden",
            }}
        >
            <ReactECharts
                option={option}
                style={{ width: "100%", height: "100%" }}
                notMerge
                lazyUpdate
            />
        </div>
    );
};

export default PieChart;
