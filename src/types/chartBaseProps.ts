import { SeriesSortAgg, SeriesSortBy } from "utils/charts/seriesSort";
import { LegendPosition } from "../utils/charts/legendLayout";
import { NumberFormatProps } from "utils/charts/numberFormat";

export interface ChartBaseProps extends NumberFormatProps {
    // ─── Datos ────────────────────────────────────────────────
    xLabel?: string;
    yLabel?: string;
    /** Criterio de orden de las series. Default: undefined (orden de llegada) */
    seriesSortBy?: SeriesSortBy;
    /** Agregación para ordenar por valor. Default: "sum" */
    seriesSortAgg?: SeriesSortAgg;

    // ─── Título ───────────────────────────────────────────────
    /** Texto del título del gráfico */
    title?: string;
    /** Mostrar u ocultar el título. Default: true */
    showTitle?: boolean;

    // ─── Límites de datos ─────────────────────────────────────
    /** Máximo de puntos a mostrar en el eje X */
    maxPoints?: number;
    /** Máximo de series a mostrar */
    maxSeries?: number;
    /** Agrupar las series excedentes como "Otros". Requiere maxSeries */
    groupOthers?: boolean;

    // ─── Etiquetas de datos ───────────────────────────────────
    /** Mostrar el valor encima de cada punto/barra. Default: false */
    showDataLabels?: boolean;

    // ─── Ejes ─────────────────────────────────────────────────
    /** Valor mínimo del eje Y */
    yMin?: number;
    /** Valor máximo del eje Y */
    yMax?: number;
    /** Invertir el sentido del eje Y. Default: false */
    invertY?: boolean;
    /** Mostrar el título del eje Y. Default: true */
    showYTitle?: boolean;
    /** Mostrar el título del eje X. Default: true */
    showXTitle?: boolean;

    // ─── Leyenda ──────────────────────────────────────────────
    /** Mostrar u ocultar la leyenda. Default: true si hay más de una serie */
    showLegend?: boolean;
    /** Posición de la leyenda. Default: "bottom-center" */
    legendPosition?: LegendPosition;

    // ─── Estilo general ───────────────────────────────────────
    /** Altura del gráfico en px. Default: 400 */
    height?: number;
    /** Color de fondo. Default: el color de superficie del tema activo */
    backgroundColor?: string;
    /** Radio del borde en px. Default: 8 */
    borderRadius?: number;
    /** Mostrar sombra exterior. Default: true */
    showShadow?: boolean;
}
