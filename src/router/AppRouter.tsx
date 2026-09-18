import { lazy, Suspense, useContext } from 'react';
import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthContext } from 'contexts/AuthContext';
import Base from 'containers/base';
import UserList from 'containers/user/UsersList';
import DashboardList from 'containers/board/DashboardList';
import LoginPage from 'containers/user/LoginPage';
import DashboardPage, { MainIndex } from './DashboardPage';

const ChartGenerator = lazy(() => import('containers/ChartGenerator'));
const ConnectionsPage = lazy(() => import('containers/admin/ConnectionsPage'));
function AdminPage({ children }: React.PropsWithChildren) {
  const { authUser } = useContext(AuthContext);
  if (!authUser) return <p>Cargando sesión…</p>;
  return authUser.profileType === 'ADMIN' ? children : <Navigate to="/main" replace />;
}

// Keep the router mounted while the catalog and permissions refresh after saving.
const router = createBrowserRouter([
  { path: '/', element: <Base />, children: [
    { index: true, element: <Navigate to="/main" replace /> },
    { path: 'main', element: <MainIndex /> },
    { path: 'generador', element: <Suspense fallback={<p>Cargando generador…</p>}><ChartGenerator /></Suspense> },
    { path: 'usuarios', element: <AdminPage><UserList /></AdminPage> },
    { path: 'tableros', element: <AdminPage><DashboardList /></AdminPage> },
    { path: 'administracion/conexiones', element: <AdminPage><Suspense fallback={<p>Cargando conexiones…</p>}><ConnectionsPage /></Suspense></AdminPage> },
    { path: ':dashboardKeyname/:sectionKeyname?', element: <DashboardPage /> },
  ] },
  { path: '/login', element: <LoginPage /> },
  { path: '*', element: <Navigate to="/main" replace /> },
]);

export default function AppRouter() { return <RouterProvider router={router} />; }
