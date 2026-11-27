import type { ChartConfig, NumberPresentation, Scalar } from 'types/Generator';

export function chartNumberText(value: Scalar | undefined, presentation: NumberPresentation | undefined): string | undefined {
  if (!presentation || typeof value !== 'number' || !Number.isFinite(value)) return;
  const number = presentation.style === 'percentage' ? value * 100 : value;
  const digits = presentation.digits;
  const text = number.toLocaleString('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: presentation.group_digits,
  });
  return presentation.style === 'decimal' ? text : text + ' %';
}

export function seriesNumberText(label: string, presentation: NumberPresentation | undefined): string {
  // Analytics sends numeric series names as strings. Keep codes such as 0012 as text.
  if (!presentation || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(label)) return label;
  return chartNumberText(Number(label), presentation) ?? label;
}

export function indicatorFormatField(config: ChartConfig): string {
  return config.indicator_lookup?.column || config.y_col || config.count_col || 'Registros';
}

export function plotlyNumberAxis(presentation: NumberPresentation) {
  const decimals = (presentation.group_digits ? ',' : '') + '.' + presentation.digits;
  return {
    tickformat: decimals + (presentation.style === 'percentage' ? '%' : 'f'),
    ticksuffix: presentation.style === 'percentage_points' ? ' %' : '',
  };
}
