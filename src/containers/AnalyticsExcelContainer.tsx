import { lazy, Suspense } from 'react';
const ChartGenerator = lazy(() => import('./ChartGenerator'));
export default function AnalyticsExcelContainer() {
  return <Suspense fallback={<p>Cargando generador…</p>}><ChartGenerator /></Suspense>;
}
