export const chartNames = {
  bar: 'Barras', horizontal: 'Barras horizontales', stacked: 'Barras apiladas',
  line: 'Líneas', area: 'Área', scatter: 'Dispersión', pie: 'Circular', donut: 'Anillo',
  histogram: 'Histograma', box: 'Caja y bigotes', heatmap: 'Mapa de calor', table: 'Tabla', indicator: 'Indicador', map: 'Mapa',
};
export type ChartType = keyof typeof chartNames;
export type Scalar = string | number | boolean | null;
export type SortAggregation = 'alphabetical' | 'sum' | 'max' | 'min' | 'count' | 'distinct';
export type SortDirection = 'asc' | 'desc';
export interface SortConfig { field: string; aggregation: SortAggregation; direction: SortDirection; }
export type ColumnAliases = Record<string, string>;
export type FilterSorts = Record<string, SortConfig>;
export interface Source { _id: string; name: string; kind: 'upload' | 'system' | 'google'; sheets?: string[]; }
export interface ReadConfig { sheet: string; header_row: number; decimal: string; types: Record<string, string>; }
export interface ChartConfig extends ReadConfig {
  chart_type: ChartType; aggregation: string; x_col: string; y_col: string; group_col: string;
  y_cols?: string[];
  date_bucket: string; filters: Record<string, string[]>;
  category_sort?: SortConfig; series_sort?: SortConfig;
  latitude_col?: string; longitude_col?: string; label_col?: string; size_col?: string; map_mode?: 'markers' | 'circles';
  map_metric_cols?: string[];
}
export interface Preview {
  columns: string[]; column_meta: Record<string, { type: string; unique_values: Scalar[]; unique_count: number; missing: number; invalid: number }>;
  row_count: number; preview: Record<string, Scalar>[]; raw_preview: Scalar[][]; warnings: string[];
}
export interface ChartData {
  labels: Scalar[]; datasets: { label: string; data: (number | null)[]; x?: Scalar[]; metric?: string; group?: string }[];
  filtered_rows: number; warnings: string[]; columns?: string[]; records?: Record<string, Scalar>[];
  map_points?: { id: string; lat: number; lng: number; label: string; value?: number | null; metrics?: { field: string; value: Scalar }[] }[];
  filter_options?: FilterOptions;
  ignored_filters?: string[];
}
export type SectionFilterSelection = { mode: 'include' | 'exclude'; values: string[] };
export type SectionFilters = Record<string, SectionFilterSelection>;
export type FilterOptions = Record<string, { values: string[]; total: number; type?: string; unfiltered_total?: number; available_selected?: string[]; sort_applied?: boolean }>;
export type ChartFilterOptions = {
  widget: Widget; filters: SectionFilters; options?: FilterOptions | null; ignoredFilters?: string[];
};
export interface Widget { id: string; title: string; width: number; library: 'Plotly' | 'ECharts'; config: ChartConfig; }
export interface SectionDestination { dashboardId: string; sectionId: string; }
export interface DestinationOption extends SectionDestination { dashboardName: string; sectionName: string; path: string; }
export interface Workspace { _id: string; name: string; source_id: string; widgets: Widget[]; destination?: SectionDestination; filter_columns?: string[]; column_aliases?: ColumnAliases; filter_sorts?: FilterSorts; }
export interface WorkspaceView extends Workspace { can_edit: boolean; source_kind: Source['kind']; source_access_mode?: 'public'; }
export interface SectionWidgetRender { data?: ChartData; error?: string; }
export interface SectionRenderResponse {
  snapshot_id: string;
  workspace: WorkspaceView;
  widgets: Record<string, SectionWidgetRender>;
  filter_options: FilterOptions;
}
export interface Publication {
  published: boolean; canShare: boolean; currentUserId: string; canView?: boolean; users: { _id: string; username: string }[]; recipientIds: string[];
  name?: string; icon?: string; path?: string; show?: boolean;
  destinations?: DestinationOption[]; destination?: DestinationOption;
}
export type SectionOptions = Publication & DestinationOption & { workspaceId?: string; canAddCharts: boolean; };
