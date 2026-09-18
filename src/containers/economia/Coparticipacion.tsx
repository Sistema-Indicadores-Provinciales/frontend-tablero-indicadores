import React, { useState, useEffect } from "react";
import { useExcelSheet } from "../../hooks/useExcelSheet";
import { useCrossFilters } from "../../hooks/useCrossFilters";
import { buildSeriesByCategory } from "../../utils/chartHelpers";
import DashboardLayout from "../../components/ui/DashboardLayout";
import DashboardItem from "../../components/ui/DashboardItem";
import FilterBar, { FilterConfig } from "../../components/ui/FilterBar";
import LineChart from "../../components/graphics/LineChart";
import BarChart, { BarSeries } from "../../components/graphics/BarChart";
import Dropdown from "../../components/ui/Dropdown";
import { Box, Button } from "@mui/material";
import LineChartPlotly from "components/graphics/LineChartPlotly";
import BarChartPlotly from "components/graphics/BarChartPlotly";

const FILENAME = "BD ECONOMIA - COPARTICIPACION.xlsx";
const SHEET_PRINCIPAL = "CFI Y TOTALES - FSA";
const SHEET_VARIACIONES = "VARIACIONES";

const FILTERS_CONFIG = {
  AÑO: { type: "single" as const, col: "AÑO", default: "latest", sort: "desc" as const, },
  MES: { type: "multiple" as const, col: "ORDEN", labelCol: "MES", default: "all" as const, sort: "asc" as const, },
  PROVINCIA: { type: "single" as const, col: "PROVINCIA1", default: "FORMOSA", sort: "asc" as const, },
  CATEGORIA: { type: "multiple" as const, col: "CATEGORIA", default: "all" as const, sort: "asc" as const, },
};

const FILTER_BAR_CONFIG: FilterConfig[] = [
  { key: "AÑO", label: "AÑO", multiple: false, width: 150 },
  { key: "MES", label: "MES", multiple: true, width: 180 },
  { key: "PROVINCIA", label: "PROVINCIA", multiple: false, searchable: true, width: 200, },
  { key: "CATEGORIA", label: "CATEGORÍA", multiple: true, width: 180 },
];

const Coparticipacion: React.FC = () => {
  const { data, loading, error } = useExcelSheet(FILENAME, SHEET_PRINCIPAL);
  const { data: dataVar, loading: loadingVar, error: errorVar } = useExcelSheet(
    FILENAME,
    SHEET_VARIACIONES,
  );

  const { filters, setFilter, clearFilters, availableOptions, filteredData, initialized, } = useCrossFilters(data?.data ?? null, FILTERS_CONFIG);

  // TIPO VARIACIÓN — estado propio, opciones desde la hoja de variaciones
  const [tipoVariacion, setTipoVariacion] = useState<string>("VARIACIÓN INTERANUAL", );
  const [libreria, setLibreria] = useState<"Plotly" | "ECharts">("Plotly");

  const tiposVariacion = dataVar
    ? [...new Set(dataVar.data.map((row) => String(row["TIPO VARIACION"])))]
        .sort()
        .map((v) => ({ value: v, label: v }))
    : [];

  // Sincroniza el default cuando llegan los datos
  useEffect(() => {
    if (tiposVariacion.length > 0) {
      const existe = tiposVariacion.some((t) => t.value === tipoVariacion);
      if (!existe) setTipoVariacion(String(tiposVariacion[0].value));
    }
  }, [tiposVariacion.length]);

  if (error || errorVar) return <p role="alert">{error || errorVar}</p>;
  if (loading || loadingVar) return <p>Cargando datos...</p>;
  if (!data || !dataVar || !initialized) return null;

  // Series hoja principal
  const seriesTotal = buildSeriesByCategory(filteredData, "CATEGORIA", "ORDEN", "MES", "TOTAL", );
  const seriesUSD = buildSeriesByCategory(filteredData, "CATEGORIA", "ORDEN", "MES", "TOTAL USD", );

  // Datos de variaciones filtrados por AÑO, MES y TIPO VARIACION
  const mesesSeleccionados = filters["MES"] as (string | number)[];
  const añoSeleccionado = filters["AÑO"];

  const datosVariaciones = dataVar.data.filter(
    (row) =>
      String(row["AÑO"]) === String(añoSeleccionado) &&
      mesesSeleccionados.map(String).includes(String(row["ORDEN"])) &&
      String(row["TIPO VARIACION"]) === tipoVariacion,
  );

  // Una serie por provincia, eje X = MES
  const provincias = [
    ...new Set(datosVariaciones.map((row) => String(row["PROVINCIA"]))),
  ].sort();

  const seriesVariacion: BarSeries[] = provincias.map((prov) => {
    const filas = datosVariaciones
      .filter((row) => String(row["PROVINCIA"]) === prov)
      .sort((a, b) => Number(a["ORDEN"]) - Number(b["ORDEN"]));

    return {
      name: prov,
      x: filas.map((row) => String(row["MES"])),
      y: filas.map((row) => (row["VARIACION"] == null || row["VARIACION"] === "" ? null : Number(row["VARIACION"]))),
    };
  });

  return (
    <DashboardLayout>
        {/* Filtros */}
        <DashboardItem colSpan={12}>
            <Box sx={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <FilterBar
                    filters={FILTER_BAR_CONFIG}
                    values={filters}
                    availableOptions={availableOptions}
                    onFilterChange={setFilter}
                    onClear={() => {}}  // el botón de limpiar se mueve abajo
                    hideClear            // prop nueva, explicada abajo
                />
                <Dropdown
                    label="TIPO VARIACIÓN"
                    options={tiposVariacion}
                    value={tipoVariacion}
                    onChange={(val) => setTipoVariacion(String(val))}
                    width={220}
                />

                {/* Selector de librería */}
                {(["Plotly", "ECharts"] as const).map(lib => (
                    <Box
                        key={lib}
                        onClick={() => setLibreria(lib)}
                        sx={{
                            padding: "5px 14px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: libreria === lib ? 700 : 400,
                            border: libreria === lib ? "2px solid #2563eb" : "1px solid #cbd5e1",
                            color: libreria === lib ? "#2563eb" : "#64748b",
                            background: libreria === lib ? "#eff6ff" : "#fff",
                            userSelect: "none",
                            transition: "all 0.15s",
                            "&:hover": {
                                borderColor: "#2563eb",
                                color: "#2563eb",
                            },
                        }}
                    >
                        {lib}
                    </Box>
                ))}

                {/* Limpiar filtros — último, negro */}
                <Button
                    variant="contained"
                    size="small"
                    onClick={() => { clearFilters(); setTipoVariacion(tiposVariacion.some(t => t.value === "VARIACIÓN INTERANUAL") ? "VARIACIÓN INTERANUAL" : String(tiposVariacion[0]?.value ?? "")); }}
                    sx={{
                        height: "36px",
                        background: "#0f172a",
                        color: "#fff",
                        fontWeight: 700,
                        "&:hover": { background: "#1e293b" },
                    }}
                >
                    Limpiar filtros
                </Button>
            </Box>
        </DashboardItem>
        <DashboardItem colSpan={6} minHeight={400}>
            {libreria === "ECharts"
                ? <LineChart
                    legendPosition={"top-center"}
                    smooth={true}
                    series={seriesTotal}
                    xLabel="MES"
                    yLabel="TOTAL EN PESOS (MILLONES)"
                    title="Total por categoría y mes"
                    numberFormat="integer"
                    numberSuffix=" M"
                />
                : <LineChartPlotly
                    series={seriesTotal}
                    xLabel="MES"
                    yLabel="TOTAL EN PESOS (MILLONES)"
                    title="Total por categoría y mes" />
            }
        </DashboardItem>

        <DashboardItem colSpan={6} minHeight={400}>
            {libreria === "ECharts"
                ? <LineChart
                    legendPosition={"top-center"}
                    series={seriesUSD}
                    xLabel="MES"
                    yLabel="TOTAL EN USD (MILES)"
                    title="Total USD por categoría y mes"
                    numberSuffix=" MILES"
                />
                : <LineChartPlotly series={seriesUSD} xLabel="Mes" yLabel="Total USD" title="Total USD por categoría y mes" />
            }
        </DashboardItem>

        <DashboardItem colSpan={12} minHeight={400}>
            {libreria === "ECharts"
                ? <BarChart
                    legendPosition="top-center"
                    seriesSortBy="desc-value"
                    series={seriesVariacion}
                    xLabel="MES"
                    yLabel={tipoVariacion}
                    title={`${tipoVariacion} de CFI en términos reales entre provincias periodo: ${+añoSeleccionado} - ${+añoSeleccionado-1}`}
                    numberFormat="percent-decimal"
                />
                : <BarChartPlotly series={seriesVariacion} xLabel="Mes" yLabel="Variación" title={`${tipoVariacion} por provincia y mes`} />
            }
        </DashboardItem>
    </DashboardLayout>
  );
};

export default Coparticipacion;
