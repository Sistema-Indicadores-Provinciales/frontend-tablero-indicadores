import { lazy, Suspense, useContext } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AuthContext } from 'contexts/AuthContext';
import Indexer from 'containers/common/Indexer';
import IndicatorContainer from 'containers/common/IndicatorContainer';
import { buildIndexerRoutes } from './dynamicRoutes';
import { getSectionContent } from './contentMap';
import DashboardSectionsPage from 'containers/board/DashboardSectionsPage';

const SavedDashboard = lazy(() => import('containers/SavedDashboard'));

function CatalogState() {
  const { catalogReady, catalogError, refreshAccessKeynames } = useContext(AuthContext);
  if (!catalogReady) return <p role="status">Cargando tableros…</p>;
  if (catalogError) return <Alert severity="error" action={<Button onClick={() => refreshAccessKeynames().catch(() => {})}>Reintentar</Button>}>No se pudo cargar el menú y sus permisos.</Alert>;
  return null;
}

export function MainIndex() {
  const { dashboards, catalogReady, catalogError } = useContext(AuthContext);
  if (!catalogReady || catalogError) return <CatalogState />;
  return <Indexer main title="indicadores provinciales" routes={buildIndexerRoutes(dashboards)} />;
}

export default function DashboardPage() {
  const { dashboardKeyname, sectionKeyname } = useParams();
  const { dashboards, accessKeynames, accessSections, catalogReady, catalogError, profileType } = useContext(AuthContext);
  if (!catalogReady || catalogError) return <CatalogState />;
  const dashboard = dashboards.find(d => d.keyname === dashboardKeyname && d.show && accessKeynames.includes(d.keyname));
  const sections = dashboard?.sections.filter(s => s.show && accessSections[dashboard.keyname]?.includes(s.keyname)) ?? [];
  const section = sectionKeyname ? sections.find(s => s.keyname === sectionKeyname) : undefined;
  if (!dashboard || (sectionKeyname && !section)) return <Stack spacing={2}>
    <Alert severity="info">Este tablero no está disponible o no tenés acceso. Consultá con un administrador.</Alert>
    <Button component={Link} to="/main">Volver al índice</Button>
  </Stack>;
  if (section?.workspaceId) return <Suspense fallback={<p>Cargando gráficos…</p>}>
    <SavedDashboard key={section.workspaceId} workspaceId={section.workspaceId} title={section.name || section.keyname} dashboardName={dashboard.name || dashboard.keyname} dashboardPath={`/${dashboard.keyname}`} />
  </Suspense>;
  if (section) {
    const content = getSectionContent(dashboard.keyname, section.keyname);
    if (content) return <IndicatorContainer title={section.name || section.keyname}>{content}</IndicatorContainer>;
    if (profileType === 'ADMIN') return <Navigate to={`/generador?tablero=${dashboard._id}&seccion=${section._id}`} replace />;
    return <Stack spacing={2}><Alert severity="info">Esta sección todavía no tiene gráficos. Un administrador puede agregarlos con el generador.</Alert><Button component={Link} to={`/${dashboard.keyname}`}>Volver al tablero</Button></Stack>;
  }
  return <DashboardSectionsPage key={dashboard._id} dashboard={dashboard} sections={sections} />;
}
