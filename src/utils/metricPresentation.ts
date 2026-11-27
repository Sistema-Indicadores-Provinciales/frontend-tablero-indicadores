import type { NumericFormat, Scalar } from 'types/Generator';

export const basicNumericFormat: NumericFormat = { style: 'number', decimals: 0, grouping: true, prefix: '', suffix: '', empty: '—' };
export function presentValue(value: Scalar | undefined, format?: NumericFormat, empty = '—'): string {
  if (value == null || (typeof value === 'number' && !Number.isFinite(value))) return format?.empty ?? empty;
  if (typeof value !== 'number') return String(value);
  if (!format) return value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const number = format.style === 'percent' ? value * 100 : value;
  const decimals = Math.min(20, Math.max(0, format.decimals));
  const text = new Intl.NumberFormat('es-AR', { useGrouping: format.grouping, minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    .formatToParts(number).map(part => part.type === 'decimal' ? format.decimal_separator ?? ',' : part.type === 'group' ? format.thousands_separator ?? '.' : part.value).join('');
  return `${format.prefix}${text}${format.style === 'percent' || format.style === 'literal' ? ' %' : ''}${format.suffix}`;
}
