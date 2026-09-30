import { FilterOptions } from 'types/Generator';

const nameKey = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const period = (name: string) => /\b(ano|anos|anio|anios|year|mes|meses|month|fecha|date|periodo|trimestre|semestre|semana)\b/.test(nameKey(name));
const measure = (name: string) => /\b(total|importe|monto|cantidad|valor|porcentaje|promedio|saldo)\b/.test(nameKey(name));

export function suggestFilterColumns(options: FilterOptions): string[] {
  const names = Object.keys(options);
  return [...names.filter(period), ...names.filter(name => !period(name) && !measure(name) &&
    options[name].type !== 'number' && options[name].total <= 100)].slice(0, 6);
}

export function sortFilterValues(column: string, values: string[]): string[] {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return [...values].sort((a, b) => {
    const first = months.indexOf(nameKey(a)), second = months.indexOf(nameKey(b));
    if (/\b(mes|meses|month)\b/.test(nameKey(column)) && first >= 0 && second >= 0) return first - second;
    return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
  });
}
