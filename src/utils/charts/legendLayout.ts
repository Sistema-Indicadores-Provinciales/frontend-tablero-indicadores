export type LegendPosition =
    | "top-left" | "top-center" | "top-right"
    | "bottom-left" | "bottom-center" | "bottom-right"
    | "left" | "right";

interface LegendLayoutResult {
    legend: object;
    gridTop: number;
    gridBottom: number;
}

const SIDE_LEGEND_SPACE = 150;
const SIDE_LEGEND_TEXT_WIDTH = 108;
const SIDE_LEGEND_WIDTH = SIDE_LEGEND_SPACE - 16;
const SIDE_LEGEND_OFFSET =
  (SIDE_LEGEND_SPACE - SIDE_LEGEND_WIDTH) / 2;

// Calcula la configuración de la leyenda y el espacio reservado en el grid
// para que no se superponga con el área del gráfico.

// @param position    Posición de la leyenda (ej: "bottom-center")
// @param show        Mostrar u ocultar la leyenda
// @param hasTitle    Si el gráfico tiene título visible (afecta el espacio superior)

export const getLegendLayout = (
    position: LegendPosition,
    show: boolean,
    hasTitle: boolean,
): LegendLayoutResult => {
    if (!show) {
        return {
            legend: { show: false },
            gridTop: hasTitle ? 50 : 20,
            gridBottom: 20,
        };
    }

    if (position === "left" || position === "right") {
        const isLeft = position === "left";

        return {
            legend: {
            show: true,
            type: "scroll",
            orient: "vertical" as const,

            top: hasTitle ? 46 : 12,
            bottom: 12,

            left: isLeft ? SIDE_LEGEND_OFFSET : undefined,
            right: isLeft ? undefined : SIDE_LEGEND_OFFSET,
            width: SIDE_LEGEND_WIDTH,

            itemWidth: 12,
            itemHeight: 12,
            itemGap: 8,

            pageButtonPosition: "end",
            pageButtonItemGap: 5,
            pageButtonGap: 8,
            pageIconColor: "#475569",
            pageIconInactiveColor: "#cbd5e1",
            pageTextStyle: {
                color: "#64748b",
                fontSize: 10,
            },

            textStyle: {
                fontSize: 10,
                color: "#475569",
                width: SIDE_LEGEND_TEXT_WIDTH,
                overflow: "truncate",
                ellipsis: "...",
            },
            },
            gridTop: hasTitle ? 50 : 20,
            gridBottom: 20,
        };
    }

    const [vAlign, hAlign] = position.split("-") as ["top" | "bottom", "left" | "center" | "right"];

    const legend = {
        show: true,
        top:    vAlign === "top"    ? 40    : undefined,
        bottom: vAlign === "bottom" ? 10    : undefined,
        left:   hAlign === "left"   ? 10
              : hAlign === "right"  ? undefined
              : "center",
        right:  hAlign === "right"  ? 10    : undefined,
        orient: "horizontal" as const,
        textStyle: { fontSize: 11, color: "#475569" },
        itemGap: 16,
    };

    const gridTop    = vAlign === "top"    ? 80 : (hasTitle ? 50 : 20);
    const gridBottom = vAlign === "bottom" ? 95 : 20;

    return { legend, gridTop, gridBottom };
};
