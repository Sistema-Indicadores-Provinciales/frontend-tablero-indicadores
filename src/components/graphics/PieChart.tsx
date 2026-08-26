// src/components/graphics/PieChart.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Box, Typography } from "@mui/material";
import { NumberFormatProps, buildFormatter } from 'utils/charts/numberFormat';

export interface PieChartDatum {
  name: string;
  value: number;
}

export type PieLegendPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "left"
  | "right"
  | "none";

export interface PieChartProps extends NumberFormatProps {
  /** Datos a graficar. */
  data: PieChartDatum[];
  /** Título del gráfico. */
  title?: string;

  /** Radio interno (0 = torta sólida, >0 = dona). Porcentaje 0-100. Default: 0 */
  innerRadius?: number;
  /** Radio externo. Porcentaje 0-100. Default: 70 */
  outerRadius?: number;

  /** Cantidad máxima de porciones antes de agrupar el resto en una sola. Sin límite si se omite. */
  maxItems?: number;
  /** Etiqueta de la porción que agrupa el resto. Default: "Otros" */
  otherLabel?: string;

  /** Tamaño de fuente de la leyenda en px. Default: 12 */
  legendFontSize?: number;
  /** Posición de la leyenda. Default: "bottom-center" */
  legendPosition?: PieLegendPosition;

  /** Muestra el valor dentro de cada porción. Default: true */
  showValue?: boolean;
  /** Tamaño de fuente del valor dentro de la porción en px. Default: 12 */
  valueFontSize?: number;
  /** Color del texto del valor dentro de la porción. Default: "#ffffff" */
  valueColor?: string;

  /** Paleta de colores. Si se omite, usa la paleta default de ECharts. */
  colors?: string[];
}

const OTHER_SLICE_COLOR = "#94a3b8";
// Factor aproximado de ancho promedio de un carácter respecto al font-size,
// para estimar en px si el texto del valor entra dentro de la porción.
const AVG_CHAR_WIDTH_FACTOR = 0.62;
// Margen de seguridad: el texto debe entrar con esta holgura extra.
const FIT_SAFETY_MARGIN = 1.15;

const LEGEND_POSITION_MAP: Record<
  Exclude<PieLegendPosition, "none">,
  Record<string, unknown>
> = {
  "top-left": { top: 4, left: 4, orient: "horizontal" },
  "top-center": { top: 4, left: "center", orient: "horizontal" },
  "top-right": { top: 4, right: 4, orient: "horizontal" },
  "bottom-left": { bottom: 4, left: 4, orient: "horizontal" },
  "bottom-center": { bottom: 4, left: "center", orient: "horizontal" },
  "bottom-right": { bottom: 4, right: 4, orient: "horizontal" },
  left: { left: 4, top: "middle", orient: "vertical" },
  right: { right: 4, top: "middle", orient: "vertical" },
};

// Centro de la torta según dónde quede la leyenda, para que no se superpongan.
const CENTER_BY_LEGEND: Record<PieLegendPosition, [string, string]> = {
  "top-left": ["50%", "56%"],
  "top-center": ["50%", "56%"],
  "top-right": ["50%", "56%"],
  "bottom-left": ["50%", "44%"],
  "bottom-center": ["50%", "44%"],
  "bottom-right": ["50%", "44%"],
  left: ["58%", "50%"],
  right: ["42%", "50%"],
  none: ["50%", "50%"],
};

/** Agrupa las porciones que exceden maxItems en una sola porción "otherLabel". */
const applyMaxItems = (
  data: PieChartDatum[],
  maxItems?: number,
  otherLabel = "Otros"
): PieChartDatum[] => {
  if (!maxItems || maxItems <= 0 || data.length <= maxItems) return data;

  const sorted = [...data].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, maxItems - 1);
  const restSum = sorted
    .slice(maxItems - 1)
    .reduce((acc, d) => acc + d.value, 0);

  return [...head, { name: otherLabel, value: restSum }];
};

const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  innerRadius = 0,
  outerRadius = 70,
  maxItems,
  otherLabel = "Otros",
  legendFontSize = 12,
  legendPosition = "bottom-center",
  showValue = true,
  valueFontSize = 12,
  valueColor = "#ffffff",
  colors,
  ...formatProps
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Medimos el contenedor real para poder calcular, en px, si el valor entra en cada porción.
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const wasGrouped = Boolean(maxItems && maxItems > 0 && data.length > maxItems);

  const groupedData = useMemo(
    () => applyMaxItems(data, maxItems, otherLabel),
    [data, maxItems, otherLabel]
  );

  const total = useMemo(
    () => groupedData.reduce((acc, d) => acc + d.value, 0),
    [groupedData]
  );

  const numberFormat = formatProps.numberFormat ?? "decimal";
  const formatter = buildFormatter(formatProps);

  const formatValue = (raw: number): string => {
    if (numberFormat === "percent" || numberFormat === "percent-decimal") {
      return formatter(total > 0 ? raw / total : 0);
    }
    return formatter(raw);
  };

  // Para cada porción, ¿el texto del valor entra en el ancho (cuerda) disponible?
  const visibleLabels = useMemo(() => {
    const { width, height } = containerSize;
    if (!width || !height || total === 0) {
      // Contenedor todavía no medido: mostramos todo en el primer render,
      // se corrige apenas el ResizeObserver informa el tamaño real.
      return groupedData.map(() => true);
    }

    const baseRadius = Math.min(width, height) / 2;
    const outerPx = baseRadius * (outerRadius / 100);
    const innerPx = baseRadius * (innerRadius / 100);
    const labelRadiusPx = (outerPx + innerPx) / 2;

    return groupedData.map((d) => {
      const angle = (d.value / total) * 2 * Math.PI;
      const chordPx = 2 * labelRadiusPx * Math.sin(angle / 2);
      const text = formatValue(d.value);
      const textWidthPx =
        text.length * valueFontSize * AVG_CHAR_WIDTH_FACTOR * FIT_SAFETY_MARGIN;
      return chordPx >= textWidthPx;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedData, containerSize, outerRadius, innerRadius, valueFontSize, total]);

  const legendOption =
    legendPosition === "none"
      ? { show: false }
      : {
          show: true,
          textStyle: { fontSize: legendFontSize, color: "#334155" },
          ...LEGEND_POSITION_MAP[legendPosition],
        };

  const option = {
    title: title
      ? {
          text: title,
          left: "center",
          textStyle: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
        }
      : undefined,
    color: colors,
    tooltip: {
      trigger: "item",
      formatter: (params: any) =>
        `${params.name}: ${formatValue(params.value)} (${params.percent}%)`,
    },
    legend: legendOption,
    series: [
      {
        type: "pie",
        radius: [`${innerRadius}%`, `${outerRadius}%`],
        center: CENTER_BY_LEGEND[legendPosition],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: "#ffffff",
          borderWidth: 2,
        },
        label: {
          show: showValue,
          position: "inside",
          fontSize: valueFontSize,
          color: valueColor,
          fontWeight: 600,
          formatter: (params: any) =>
            visibleLabels[params.dataIndex] ? formatValue(params.value) : "",
        },
        labelLine: { show: false },
        data: groupedData.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle:
            wasGrouped && d.name === otherLabel
              ? { color: OTHER_SLICE_COLOR }
              : undefined,
        })),
      },
    ],
  };

  return (
    <Box ref={containerRef} sx={{ width: "100%", height: "100%", minHeight: 0 }}>
      {data.length === 0 ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <Typography sx={{ fontSize: "13px", color: "#94a3b8" }}>
            Sin datos para mostrar
          </Typography>
        </Box>
      ) : (
        <ReactECharts option={option} style={{ width: "100%", height: "100%" }} notMerge />
      )}
    </Box>
  );
};

export default PieChart;