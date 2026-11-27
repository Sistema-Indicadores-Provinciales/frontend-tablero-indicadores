import { useState } from 'react';
import { columnLabel, metricColumns } from 'utils/generatorConfig';
import { chartNumberText, indicatorFormatField } from 'utils/chartNumbers';
import type { ChartConfig, ColumnAliases, NumberPresentation } from 'types/Generator';

function formatFields(config: ChartConfig, columns: string[]) {
  switch (config.chart_type) {
    case 'table':
      return config.table_mode === 'summary' ? columns : config.table_columns || columns;
    case 'indicator':
      return config.indicator_text_column ? [] : [indicatorFormatField(config)];
    case 'map':
      return [...(config.map_metric_cols || []), ...(config.map_lookup ? metricColumns(config) : [])];
    case 'histogram':
      return [config.group_col];
    default:
      return [...metricColumns(config), config.x_col, config.group_col];
  }
}

export default function ChartNumberSettings({ config, columns, aliases, onChange }: {
  config: ChartConfig;
  columns: string[];
  aliases: ColumnAliases;
  onChange: (column: string, format?: NumberPresentation) => void;
}) {
  const [selected, setSelected] = useState('');
  const fields = [...new Set(formatFields(config, columns).filter((column): column is string => !!column))];
  if (!fields.length) return null;
  const column = fields.includes(selected) ? selected : fields[0];
  const format = config.number_formats?.[column];
  const isDimension = column === config.group_col || (config.chart_type !== 'indicator' && column === config.x_col);
  return <details className="generator-restrictions">
    <summary>Formato numérico</summary>
    <div className="generator-controls">
      <label>Columna o métrica<select value={column} onChange={event => setSelected(event.target.value)}>
        {fields.map(field => <option key={field} value={field}>{columnLabel(field, aliases)}</option>)}
      </select></label>
      <label>Presentar como<select value={format?.style || ''} onChange={event => {
        const style = event.target.value as NumberPresentation['style'] | '';
        onChange(column, style ? { digits: isDimension ? 0 : 2, group_digits: !isDimension, ...format, style } : undefined);
      }}>
        <option value="">Automático</option>
        <option value="decimal">Número</option>
        <option value="percentage">Porcentaje (0,25 → 25 %)</option>
        <option value="percentage_points">Porcentaje (25 → 25 %)</option>
      </select></label>
      {format && <>
        <label>Decimales<select value={format.digits} onChange={event => onChange(column, { ...format, digits: Number(event.target.value) })}>
          {Array.from({ length: 7 }, (_, digits) => <option key={digits} value={digits}>{digits}</option>)}
        </select></label>
        <label><input type="checkbox" checked={format.group_digits} onChange={event => onChange(column, { ...format, group_digits: event.target.checked })} />Separar miles</label>
        <p className="generator-hint">Ejemplo: {chartNumberText(isDimension ? 2024 : format.style === 'percentage' ? .2534 : 1234.56, format)}</p>
      </>}
      <button type="button" disabled={!format} onClick={() => onChange(column)}>Restablecer formato</button>
    </div>
  </details>;
}
