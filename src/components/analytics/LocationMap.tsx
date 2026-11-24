import { lazy, Suspense, useMemo } from 'react';
import { ChartData, ColumnAliases, Scalar, Widget } from 'types/Generator';
import { useChartTheme } from 'utils/charts/chartTheme';
import { columnLabel } from 'utils/generatorConfig';

const MapsChart = lazy(() => import('components/graphics/MapsChart'));
type Point = NonNullable<ChartData['map_points']>[number];
const format = (value: Scalar | undefined) => value == null ? 'Sin dato'
  : typeof value === 'number' ? value.toLocaleString('es-AR') : String(value);

export default function LocationMap({ widget, result, aliases }: {
  widget: Widget; result: ChartData; aliases?: ColumnAliases;
}) {
  const theme = useChartTheme();
  const lookup = widget.config.map_lookup!;
  const grouped = useMemo(() => {
    const groups = new Map<string, Point[]>();
    for (const point of result.map_points || []) {
      const key = `${point.lat},${point.lng}`;
      groups.set(key, [...(groups.get(key) || []), point]);
    }
    return [...groups.values()];
  }, [result.map_points]);
  // Keep each category's color when another filter removes its neighbours.
  const categories = [...new Set((result.map_points || []).map(p => p.category).filter((v): v is string => !!v))].sort();
  const knownCategories = ['Hospital', 'Centro de Salud', 'C.I.C', 'Establecimiento de salud sin internación de diagnóstico', 'Establecimiento de salud complementario (ESCL)'];
  const color = (category: string) => {
    const known = knownCategories.indexOf(category);
    return theme.colors[(known >= 0 ? known : [...category].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 0)) % theme.colors.length];
  };
  // Coincident groups retain separate measurements; never add averages or
  // distinct counts just because two names share a geographic reference.
  const values = grouped.map(group => Math.max(0, ...group.map(point => point.value || 0)));
  const maximum = Math.max(0, ...values);
  const scaled = lookup.sized !== false;
  const info = (group: Point[]) => <div className="generator-map-info">
    <strong>{group[0].location_name || group[0].label}</strong>
    {group.map(point => <div key={point.id} className="generator-location-detail">
      <b>{point.label}{point.category ? ` · ${point.category}` : ''}</b>
      {point.location_note && <p>{point.location_note}</p>}
      <dl>{point.metrics?.map(metric => <div key={metric.field}>
        <dt>{columnLabel(metric.field, aliases)}</dt><dd>{format(metric.value)}</dd>
      </div>)}</dl>
    </div>)}
  </div>;
  const circles = grouped.flatMap((group, index) => {
    if (scaled && values[index] <= 0) return [];
    const types = [...new Set(group.map(p => p.category).filter((v): v is string => !!v))].sort();
    const rings = !scaled && types.length ? types : [''];
    return rings.map((category, ring) => {
      const fill = category ? color(category) : theme.colors[0];
      return { id: JSON.stringify([group.map(p => p.id), category]), center: { lat: group[0].lat, lng: group[0].lng },
        radius: scaled ? Math.max(1000, 18000 * Math.sqrt(values[index] / maximum)) : 5000 * (1 - ring / (rings.length + 1)),
        options: { fillColor: fill, fillOpacity: scaled || ring === rings.length - 1 ? .55 : 0,
          strokeColor: fill, strokeOpacity: 1, strokeWeight: 2 }, infoContent: info(group) };
    });
  });
  const missing = result.map_unlocated?.length || 0;
  return <>
    <div className="generator-location-summary" role="status">
      {grouped.length} ubicaciones verificadas{missing > 0 && ` · ${missing} grupos sin ubicación puntual`}
    </div>
    <Suspense fallback={<p>Cargando mapa…</p>}><div className="generator-map">
      <MapsChart height="450px" displayMode="circles" circles={circles} highlightFormosa />
    </div></Suspense>
    {scaled && !circles.length && <p className="generator-hint">No hay valores positivos con ubicación verificada para esta selección. Consultá el detalle.</p>}
    {!!categories.length && <div className="generator-map-legend" aria-label="Tipos de establecimientos">
      {categories.map(category => <span key={category}><i style={{ background: color(category) }} />{category}</span>)}
    </div>}
    {!!missing && <p role="note">Los grupos sin ubicación puntual conservan sus valores en el detalle. Esto incluye agrupaciones como «Otros» y áreas sin un punto verificado.</p>}
  </>;
}
