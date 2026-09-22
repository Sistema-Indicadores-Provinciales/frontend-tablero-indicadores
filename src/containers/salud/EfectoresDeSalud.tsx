import React from "react";
import { Box, Button } from "@mui/material";

import { useExcelSheet } from "../../hooks/useExcelSheet";
import { useCrossFilters } from "../../hooks/useCrossFilters";

import DashboardLayout from "../../components/ui/DashboardLayout";
import DashboardItem from "../../components/ui/DashboardItem";
import FilterBar, { FilterConfig } from "../../components/ui/FilterBar";
import MapsChart, {MapMarker} from "../../components/graphics/MapsChart";
import { buildPieDataByCategory } from "../../utils/chartHelpers";
import SummaryTree, { SummaryTreeNode } from "../../components/graphics/SummaryTree";
import PieChart from "components/graphics/PieChart";

const FILENAME = "BD SALUD - CENTROS DE SALUD Y HOSPITALES.xlsx";
const SHEET_PRINCIPAL = "CENTROS DE SALUD";

const FILTERS_CONFIG = {
  DISTRITO: {
    type: "multiple" as const,
    col: "DISTRITO",
    default: "all" as const,
    sort: "asc" as const,
  },
  AREA_PROGRAMATICA: {
    type: "multiple" as const,
    col: "ÁREA PROGRÁMATICA",
    default: "all" as const,
    sort: "asc" as const,
  },
  LOCALIDAD: {
    type: "multiple" as const,
    col: "LOCALIDAD",
    default: "all" as const,
    sort: "asc" as const,
  },
  TIPO: {
    type: "multiple" as const,
    col: "TIPO",
    default: "all" as const,
    sort: "asc" as const,
  },
  EFECTOR: {
    type: "multiple" as const,
    col: "NOMBRE DEL ESTABLECIMIENTO",
    default: "all" as const,
    sort: "asc" as const,
  },
  DEPENDENCIA_ADMINISTRATIVA: {
    type: "multiple" as const,
    col: "DEPENDENCIA ADMINISTRATIVA",
    default: "all" as const,
    sort: "asc" as const,
  },
  NIVEL_ATENCION: {
    type: "multiple" as const,
    col: "NIVEL DE ATENCIÓN",
    default: "all" as const,
    sort: "asc" as const,
  },
  NIVEL_COMPLEJIDAD: {
    type: "multiple" as const,
    col: "NIVEL DE COMPLEJIDAD",
    default: "all" as const,
    sort: "asc" as const,
  },
};

const FILTER_BAR_CONFIG: FilterConfig[] = [
  {
    key: "DISTRITO",
    label: "DISTRITO",
    multiple: true,
    searchable: true,
    width: 180,
  },
  {
    key: "AREA_PROGRAMATICA",
    label: "ÁREA PROGRÁMATICA",
    multiple: true,
    searchable: true,
    width: 220,
  },
  {
    key: "LOCALIDAD",
    label: "LOCALIDAD",
    multiple: true,
    searchable: true,
    width: 180,
  },
  {
    key: "TIPO",
    label: "TIPO",
    multiple: true,
    searchable: true,
    width: 160,
  },
  {
    key: "EFECTOR",
    label: "EFECTORES DE SALUD",
    multiple: true,
    searchable: true,
    width: 260,
  },
  {
    key: "DEPENDENCIA_ADMINISTRATIVA",
    label: "DEPENDENCIA ADMINISTRATIVA",
    multiple: true,
    searchable: true,
    width: 260,
  },
  {
    key: "NIVEL_ATENCION",
    label: "NIVEL DE ATENCIÓN",
    multiple: true,
    searchable: true,
    width: 200,
  },
  {
    key: "NIVEL_COMPLEJIDAD",
    label: "NIVEL DE COMPLEJIDAD",
    multiple: true,
    searchable: true,
    width: 220,
  },
];

const EfectoresDeSalud: React.FC = () => {
  const { data, loading } = useExcelSheet(
    FILENAME,
    SHEET_PRINCIPAL
  );

  const {
    filters,
    setFilter,
    clearFilters,
    availableOptions,
    filteredData,
    initialized,
  } = useCrossFilters(
    data?.data ?? null,
    FILTERS_CONFIG
  );

  if (loading) return <p>Cargando datos...</p>;
  if (!data || !initialized) return null;

  const markers: MapMarker[] = filteredData
  .filter((row) => {
    const lat = Number(row["LATITUD"]);
    const lng = Number(row["LONGITUD"]);

    return !Number.isNaN(lat) && !Number.isNaN(lng);
  })
  .map((row) => ({
    id: String(row["NOMBRE DEL ESTABLECIMIENTO"]),

    position: {
      lat: Number(row["LATITUD"]),
      lng: Number(row["LONGITUD"]),
    },

    title: String(row["NOMBRE DEL ESTABLECIMIENTO"]),
  }));

  // Desglose de efectores por DEPENDENCIA ADMINISTRATIVA (ej: Provincial / Municipal)
  const dependenciaCounts = filteredData.reduce<Record<string, number>>(
    (acc, row) => {
      const key = String(row["DEPENDENCIA ADMINISTRATIVA"] ?? "SIN DATO");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const summaryData: SummaryTreeNode = {
    id: "total-efectores",
    title: "TOTAL EFECTORES",
    value: filteredData.length,
    children: Object.entries(dependenciaCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dependencia, count]) => ({
        id: `dependencia-${dependencia}`,
        title: dependencia,
        value: count,
      })),
  };

  const establecimientosPorDistrito = buildPieDataByCategory(
    filteredData,
    "DISTRITO",
  );

  const establecimientosPorAreaProgramatica = buildPieDataByCategory(
    filteredData,
    "ÁREA PROGRÁMATICA",
  );

  const establecimientosPorNivelAtencion = buildPieDataByCategory(
    filteredData,
    "NIVEL DE ATENCIÓN",
  );

  const establecimientosPorTipo = buildPieDataByCategory(
    filteredData,
    "TIPO",
  );
  return (
    <DashboardLayout>
      <DashboardItem colSpan={12}>
        <Box
          sx={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <FilterBar
            filters={FILTER_BAR_CONFIG}
            values={filters}
            availableOptions={availableOptions}
            onFilterChange={setFilter}
            onClear={() => {}}
            hideClear
          />

          <Button
            variant="contained"
            size="small"
            onClick={clearFilters}
            sx={{
              height: "36px",
              background: "#0f172a",
              color: "#fff",
              fontWeight: 700,
              "&:hover": {
                background: "#1e293b",
              },
            }}
          >
            Limpiar filtros
          </Button>
        </Box>
      </DashboardItem>

      <DashboardItem colSpan={4}>
        <PieChart
          data={establecimientosPorDistrito}
          title="Establecimientos por distrito"
          legendPosition="right"
          legendFontSize={12}
          numberFormat="integer"
          maxSeries={9}
          height={300}
          showShadow={false}
        />
      </DashboardItem>

      <DashboardItem colSpan={4}>
        <PieChart
          data={establecimientosPorAreaProgramatica}
          title="Establecimientos por área programática"
          legendPosition="right"
          legendFontSize={12}
          numberFormat="integer"
          maxSeries={9}
          height={300}
          showShadow={false}
        />
      </DashboardItem>

      <DashboardItem colSpan={4}>
        <PieChart
          data={establecimientosPorNivelAtencion}
          title="Establecimientos por nivel de atención"
          legendPosition="right"
          legendFontSize={12}
          numberFormat="integer"
          maxSeries={9}
          height={300}
          showShadow={false}
        />
      </DashboardItem>

      <DashboardItem colSpan={4}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <SummaryTree
            data={summaryData}
            defaultCardProps={{ numberFormat: "integer" }}
          />

          <PieChart
            data={establecimientosPorTipo}
            title="Establecimientos por tipo"
            legendPosition="right"
            legendFontSize={12}
            numberFormat="integer"
            maxSeries={9}
            height={300}
            showShadow={false}
          />
        </Box>
      </DashboardItem>

      <DashboardItem colSpan={8} minHeight={620}>
        <MapsChart
          markers={markers}
          displayMode="markers"
          fitBounds
          height="620px"
        />
      </DashboardItem>
    </DashboardLayout>
  );
};

export default EfectoresDeSalud;
