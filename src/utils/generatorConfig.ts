import { ChartConfig, ColumnAliases, SortConfig } from 'types/Generator';

export const columnLabel = (column: string, aliases?: ColumnAliases): string => aliases?.[column]?.trim() || column;

export const defaultSort = (field: string): SortConfig => ({
  field,
  aggregation: 'alphabetical',
  direction: 'asc',
});

export const metricColumns = (config: Pick<ChartConfig, 'y_col' | 'y_cols'>): string[] => (
  [...new Set([config.y_col, ...(config.y_cols || [])].filter(Boolean))]
);
