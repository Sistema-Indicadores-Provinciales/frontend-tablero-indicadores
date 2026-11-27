import type { ChartConfig, ReadConfig, Widget, Workspace } from 'types/Generator';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value);
export function equalValues(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true;
  if (Array.isArray(first) && Array.isArray(second)) return first.length === second.length && first.every((value, index) => equalValues(value, second[index]));
  if (object(first) && object(second)) {
    const keys = Object.keys(first).filter(key => first[key] !== undefined);
    const other = Object.keys(second).filter(key => second[key] !== undefined);
    return keys.length === other.length && keys.every(key => key in second
      && (key !== 'computed_columns' || !object(first[key]) || !object(second[key]) || JSON.stringify(Object.keys(first[key])) === JSON.stringify(Object.keys(second[key])))
      && equalValues(first[key], second[key]));
  }
  return false;
}

export const readSettings = (config: Partial<ReadConfig>): ReadConfig => ({
  sheet: config.sheet || '', header_row: config.header_row ?? 1, decimal: config.decimal ?? ',', types: config.types ?? {},
  ...(config.computed_columns !== undefined ? { computed_columns: config.computed_columns } : {}),
  ...(config.aggregate_join !== undefined ? { aggregate_join: config.aggregate_join } : {}),
  ...(config.google_summary !== undefined ? { google_summary: config.google_summary } : {}),
});

export function visibleWidget(widget: Widget): Widget {
  return { ...widget, library: widget.library ?? 'Plotly', width: widget.width ?? 12,
    config: { ...widget.config, ...readSettings(widget.config), chart_type: widget.config.chart_type ?? 'bar', aggregation: widget.config.aggregation ?? 'sum',
      x_col: widget.config.x_col ?? '', y_col: widget.config.y_col ?? '', group_col: widget.config.group_col ?? '', date_bucket: widget.config.date_bucket ?? 'none', filters: widget.config.filters ?? {} } as ChartConfig };
}

export type EditorChange = { action: 'set' | 'delete' | 'insert' | 'remove' | 'reorder'; widget?: string; path?: string[]; value?: unknown };
export function changedProperties(before: unknown, after: unknown, path: string[] = [], widget?: string): EditorChange[] {
  if (equalValues(before, after)) return [];
  if (path[path.length - 1] !== 'computed_columns' && object(before) && object(after)) return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key =>
    changedProperties(before[key], after[key], [...path, key], widget));
  return [{ action: after === undefined ? 'delete' : 'set', path, ...(widget ? { widget } : {}), ...(after === undefined ? {} : { value: after }) }];
}

export function applyVisibleEdits(original: Widget, updated: Partial<Widget>): Widget {
  const before = visibleWidget(original);
  const result = structuredClone(original) as unknown as ObjectValue;
  for (const change of changedProperties(before, { ...before, ...updated })) {
    const path = change.path!;
    let target = result;
    for (const key of path.slice(0, -1)) {
      if (!object(target[key])) target[key] = {};
      target = target[key] as ObjectValue;
    }
    if (change.action === 'delete') delete target[path[path.length - 1]];
    else target[path[path.length - 1]] = change.value;
  }
  return result as unknown as Widget;
}

export function workspaceEdits(before: Workspace, after: Workspace): EditorChange[] {
  const changes: EditorChange[] = [];
  for (const key of ['name', 'source_id', 'filter_columns', 'column_aliases', 'filter_sorts', 'filter_option_rules', 'default_filters', 'filter_settings'] as const)
    changes.push(...changedProperties(before[key], after[key], [key]));
  const previous = new Map(before.widgets.map(widget => [widget.id, widget]));
  const current = new Set(after.widgets.map(widget => widget.id));
  for (const widget of before.widgets) if (!current.has(widget.id)) changes.push({ action: 'remove', widget: widget.id });
  for (const widget of after.widgets) {
    const original = previous.get(widget.id);
    if (!original) changes.push({ action: 'insert', widget: widget.id, value: widget });
    else changes.push(...changedProperties(original, widget, [], widget.id));
  }
  const order = [...before.widgets.filter(widget => current.has(widget.id)), ...after.widgets.filter(widget => !previous.has(widget.id))].map(widget => widget.id);
  if (!equalValues(order, after.widgets.map(widget => widget.id))) changes.push({ action: 'reorder', value: after.widgets.map(widget => widget.id) });
  return changes;
}
