export const chartNames = {
  bar: 'Barras', horizontal: 'Barras horizontales', stacked: 'Barras apiladas',
  line: 'Líneas', area: 'Área', scatter: 'Dispersión', pie: 'Circular', donut: 'Anillo',
  histogram: 'Histograma', box: 'Caja y bigotes', heatmap: 'Mapa de calor', table: 'Tabla', indicator: 'Indicador', map: 'Mapa',
};
export type ChartType = keyof typeof chartNames;
export type Scalar = string | number | boolean | null;
export type SortAggregation = 'alphabetical' | 'sum' | 'max' | 'min' | 'count' | 'distinct';
export type SortDirection = 'asc' | 'desc';
export type PieLabelMode = 'percent' | 'value';
export interface NumberPresentation {
  style: 'decimal' | 'percentage' | 'percentage_points';
  digits: number;
  group_digits: boolean;
}
export interface SortConfig { field: string; aggregation: SortAggregation; direction: SortDirection; tie_order?: string[]; tie_breaker?: 'alphabetical' | 'source_heap'; }
export type ColumnAliases = Record<string, string>;
export type FilterSorts = Record<string, SortConfig>;
export interface Source { _id: string; name: string; kind: 'upload' | 'system' | 'google'; sheets?: string[]; }
export interface TextPart { column?: string; literal?: string; start?: number; length?: number | null; case?: 'none' | 'upper' | 'lower'; }
export interface AggregateJoin { sheet: string; header_row?: number; decimal?: string; types?: Record<string, string>; keys: string[]; right_dimensions?: string[]; left_sums: string[]; right_sums: Record<string, string>; }
export interface GoogleSummary { dimensions: string[]; counts: Record<string, string>; max_values?: Record<string, string>; row_count?: string; }
export interface ReadConfig { sheet: string; header_row: number; decimal: string; types: Record<string, string>; computed_columns?: Record<string, TextPart[]>; aggregate_join?: AggregateJoin | null; google_summary?: GoogleSummary | null; }
export interface FilterRule { column: string; operator: 'equal' | 'not_equal' | 'contains' | 'not_contains' | 'empty' | 'not_empty' | 'in' | 'greater_equal'; value: string; values?: string[]; }
export interface ChartConfig extends ReadConfig {
  chart_type: ChartType; aggregation: string; x_col: string; y_col: string; group_col: string;
  y_cols?: string[];
  pie_label_mode?: PieLabelMode;
  bar_label_mode?: 'value' | 'second_metric' | 'percent_of_stack';
  filter_rules?: FilterRule[]; table_mode?: 'rows' | 'summary'; category_limit?: number | null; include_other?: boolean;
  count_col?: string; indicator_condition?: { column: string; minimum: number } | null; indicator_rules?: FilterRule[];
  indicator_divisor?: number; indicator_rounding?: 'none' | 'floor' | 'ceil';
  indicator_lookup?: { column: string; values: Record<string, number> } | null;
  indicator_sum_rules?: FilterRule[];
  indicator_addends?: string[]; indicator_text_column?: string;
  indicator_single_value_columns?: string[]; value_format?: 'number' | 'percent' | 'percent_points';
  number_formats?: Record<string, NumberPresentation>;
  calculated_fields?: Record<string, string>;
  indicator_ratio?: { denominator: string; scale: number } | null;
  indicator_decimals?: number | null; indicator_suffix?: string; indicator_empty?: 'missing' | 'zero';
  table_dimensions?: string[]; table_sorts?: SortConfig[]; table_columns?: string[];
  preserve_empty_categories?: boolean;
  metric_condition?: { column: string; excluded_value: string } | null;
  metric_ratio?: { denominator: string; scale: number; subtract_denominator?: boolean; series_order?: 'asc' | 'desc' | null } | null;
  series_limit?: number | null;
  date_bucket: string; filters: Record<string, string[]>;
  category_sort?: SortConfig; series_sort?: SortConfig;
  latitude_col?: string; longitude_col?: string; label_col?: string; size_col?: string; map_mode?: 'markers' | 'circles';
  map_metric_cols?: string[];
  map_lookup?: { column: string; locations: Record<string, { lat: number; lng: number; name: string; reference: string; note?: string }>; category_col?: string; sized?: boolean } | null;
}
export interface Preview {
  columns: string[]; column_meta: Record<string, { type: string; unique_values: Scalar[]; unique_count: number; missing: number; invalid: number }>;
  row_count: number; preview: Record<string, Scalar>[]; raw_preview: Scalar[][]; warnings: string[];
}
export interface ChartData {
  labels: Scalar[]; datasets: { label: string; data: (number | null)[]; x?: Scalar[]; metric?: string; group?: string }[];
  indicator_text?: string | null;
  filtered_rows: number; warnings: string[]; columns?: string[]; records?: Record<string, Scalar>[];
  map_points?: { id: string; lat: number; lng: number; label: string; value?: number | null; category?: string | null; location_name?: string; location_note?: string; metrics?: { field: string; value: Scalar }[] }[];
  map_unlocated?: Record<string, Scalar>[];
  filter_options?: FilterOptions;
  ignored_filters?: string[];
}
export type SectionFilterSelection = { mode: 'include' | 'exclude'; values: string[] };
export type SectionFilters = Record<string, SectionFilterSelection>;
export type FilterOptions = Record<string, { values: string[]; total: number; type?: string; unfiltered_total?: number; available_selected?: string[]; sort_applied?: boolean }>;
export type ChartFilterOptions = {
  widget: Widget; filters: SectionFilters; options?: FilterOptions | null; ignoredFilters?: string[];
};
export interface Widget { source_id?: string; id: string; title: string; width: number; library: 'Plotly' | 'ECharts'; config: ChartConfig; }
export interface SectionDestination { dashboardId: string; sectionId: string; }
export interface DestinationOption extends SectionDestination { dashboardName: string; sectionName: string; path: string; }
export interface Workspace { _id: string; name: string; source_id: string; widgets: Widget[]; destination?: SectionDestination; filter_columns?: string[]; column_aliases?: ColumnAliases; filter_sorts?: FilterSorts; filter_option_rules?: FilterRule[]; default_filters?: Record<string, string[]>; }
export interface WorkspaceView extends Workspace { can_edit: boolean; requires_google?: boolean; source_kind: Source['kind']; source_access_mode?: 'public'; }
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
