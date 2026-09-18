import { JSX, lazy, Suspense } from 'react';
const Coparticipacion = lazy(() => import('containers/economia/Coparticipacion'));

// Estructura: contentMap[keyname-del-tablero][keyname-de-la-sección]

const contentMap: Record<string, Record<string, JSX.Element>> = {
  // 'keyname-del-tablero': {
  //   'keyname-de-la-seccion': <Componente />
  // }
  "economia": {
    "coparticipacion---cfi-y-totales": <Suspense fallback={<p>Cargando Coparticipación…</p>}><Coparticipacion /></Suspense>
  }
  // "tablero-de-salud": { "efectores-de-salud": <EfectoresDeSalud /> }
  //   ↑ pendiente: el Excel que necesita (BD SALUD - CENTROS DE SALUD Y
  //     HOSPITALES.xlsx) no está en analytics-service/data/, da 404.
};

export const getSectionContent = (dashboardKeyname: string, sectionKeyname: string): JSX.Element | null => {
  return contentMap[dashboardKeyname]?.[sectionKeyname] ?? null;
};

export default contentMap;
