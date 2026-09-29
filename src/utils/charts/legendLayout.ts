export type LegendPosition =
    | "top-left" | "top-center" | "top-right"
    | "bottom-left" | "bottom-center" | "bottom-right";

interface LegendLayoutResult {
    legend: object;
    gridTop: number;
    gridBottom: number;
}


// Calcula la configuración de la leyenda y el espacio reservado en el grid
// para que no se superponga con el área del gráfico.

// @param position    Posición de la leyenda (ej: "bottom-center")
// @param show        Mostrar u ocultar la leyenda
// @param hasTitle    Si el gráfico tiene título visible (afecta el espacio superior)

export const getLegendLayout = (
    position: LegendPosition,
    show: boolean,
    hasTitle: boolean,
    textColor = "#475569",
): LegendLayoutResult => {
    if (!show) {
        return {
            legend: { show: false },
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
        textStyle: { fontSize: 11, color: textColor },
        itemGap: 16,
    };

    const gridTop    = vAlign === "top"    ? 80 : (hasTitle ? 50 : 20);
    const gridBottom = vAlign === "bottom" ? 95 : 20;

    return { legend, gridTop, gridBottom };
};
