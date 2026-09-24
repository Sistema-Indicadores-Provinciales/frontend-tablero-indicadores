export const chartNames = {
  bar: 'Barras', horizontal: 'Barras horizontales', stacked: 'Barras apiladas',
  line: 'Líneas', area: 'Área', scatter: 'Dispersión', pie: 'Circular', donut: 'Anillo',
  histogram: 'Histograma', box: 'Caja y bigotes', heatmap: 'Mapa de calor', table: 'Tabla', indicator: 'Indicador',
};
export type ChartType = keyof typeof chartNames;
export type Scalar = string | number | boolean | null;
export interface Source { _id: string; name: string; kind: 'upload' | 'system' | 'google'; sheets?: string[]; }
export interface ReadConfig { sheet: string; header_row: number; decimal: string; types: Record<string, string>; }
export interface ChartConfig extends ReadConfig {
  chart_type: ChartType; aggregation: string; x_col: string; y_col: string; group_col: string;
  date_bucket: string; filters: Record<string, string[]>;
}
export interface Preview {
  columns: string[]; column_meta: Record<string, { type: string; unique_values: Scalar[]; unique_count: number; missing: number; invalid: number }>;
  row_count: number; preview: Record<string, Scalar>[]; raw_preview: Scalar[][]; warnings: string[];
}
export interface ChartData {
  labels: Scalar[]; datasets: { label: string; data: (number | null)[]; x?: Scalar[] }[];
  filtered_rows: number; warnings: string[]; columns?: string[]; records?: Record<string, Scalar>[];
  filter_options?: Record<string, { values: string[]; total: number }>;
}
export interface Widget { id: string; title: string; width: number; library: 'Plotly' | 'ECharts'; config: ChartConfig; }
export interface SectionDestination { dashboardId: string; sectionId: string; }
export interface DestinationOption extends SectionDestination { dashboardName: string; sectionName: string; path: string; }
export interface Workspace { _id: string; name: string; source_id: string; widgets: Widget[]; destination?: SectionDestination; }
export interface WorkspaceView extends Workspace { can_edit: boolean; source_kind: Source['kind']; source_access_mode?: 'public'; }
export interface Publication {
  published: boolean; canShare: boolean; currentUserId: string; canView?: boolean; users: { _id: string; username: string }[]; recipientIds: string[];
  name?: string; icon?: string; path?: string; show?: boolean;
  destinations?: DestinationOption[]; destination?: DestinationOption;
}
export type SectionOptions = Publication & DestinationOption & { workspaceId?: string; canAddCharts: boolean; };
