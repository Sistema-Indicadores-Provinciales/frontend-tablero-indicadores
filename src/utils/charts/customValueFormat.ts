export const customValueFormatOptions = ['Number(0)', 'Number(2)', 'Percent(0)', 'Percent(2)'] as const;

const localeNumber = (value: number, minimumFractionDigits: number, maximumFractionDigits = minimumFractionDigits, useGrouping = true) =>
  value.toLocaleString('es-AR', { minimumFractionDigits, maximumFractionDigits, useGrouping });

const withoutQuotedLiterals = (pattern: string) => pattern.replace(/'[^']*'|"[^"]*"/g, '');
const visibleLiterals = (pattern: string) => pattern.replace(/'([^']*)'|"([^"]*)"/g, (_, single, double) => single ?? double ?? '');

/** Formats chart values with the four presets or a compact spreadsheet-style pattern. */
export function formatChartValue(value: number | null | undefined, format?: string): string {
  if (value == null || !Number.isFinite(value)) return 'Sin dato';
  const selected = format?.trim();
  if (!selected) return value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  if (selected === 'Number(0)') return localeNumber(value, 0);
  if (selected === 'Number(2)') return localeNumber(value, 2);
  if (selected === 'Percent(0)') return `${localeNumber(value * 100, 0)}%`;
  if (selected === 'Percent(2)') return `${localeNumber(value * 100, 2)}%`;

  const positivePattern = selected.split(';', 1)[0];
  const match = /[#0][#0,]*(?:\.[#0]+)?/.exec(positivePattern);
  if (!match || match.index == null) return `${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}${visibleLiterals(positivePattern)}`;

  const mask = match[0];
  const decimals = mask.split('.')[1] || '';
  const minimumFractionDigits = [...decimals].filter(character => character === '0').length;
  const maximumFractionDigits = decimals.length;
  const scalesAsPercent = withoutQuotedLiterals(positivePattern).includes('%');
  const formatted = localeNumber(scalesAsPercent ? value * 100 : value, minimumFractionDigits, maximumFractionDigits, mask.includes(','));
  const prefix = visibleLiterals(positivePattern.slice(0, match.index));
  const suffix = visibleLiterals(positivePattern.slice(match.index + mask.length));
  return `${prefix}${formatted}${suffix}`;
}

/** Translates the supported format subset to Plotly's numeric-axis options. */
export function plotlyAxisFormat(format?: string): { tickformat?: string; tickprefix?: string; ticksuffix?: string } {
  const selected = format?.trim();
  if (!selected) return {};
  if (selected === 'Number(0)') return { tickformat: ',.0f' };
  if (selected === 'Number(2)') return { tickformat: ',.2f' };
  if (selected === 'Percent(0)') return { tickformat: '.0%' };
  if (selected === 'Percent(2)') return { tickformat: '.2%' };

  const positivePattern = selected.split(';', 1)[0];
  const match = /[#0][#0,]*(?:\.[#0]+)?/.exec(positivePattern);
  if (!match || match.index == null) return { ticksuffix: visibleLiterals(positivePattern) };
  const mask = match[0];
  const decimals = (mask.split('.')[1] || '').length;
  const scalesAsPercent = withoutQuotedLiterals(positivePattern).includes('%');
  const axisLiteral = (literal: string) => scalesAsPercent ? literal.replace(/%/g, '') : literal;
  const prefix = axisLiteral(visibleLiterals(positivePattern.slice(0, match.index)));
  const suffix = axisLiteral(visibleLiterals(positivePattern.slice(match.index + mask.length)));
  return {
    tickformat: scalesAsPercent ? `.${decimals}%` : `${mask.includes(',') ? ',' : ''}.${decimals}f`,
    ...(prefix ? { tickprefix: prefix } : {}),
    ...(suffix ? { ticksuffix: suffix } : {}),
  };
}
