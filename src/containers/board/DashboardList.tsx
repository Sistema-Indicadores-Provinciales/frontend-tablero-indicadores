import { useContext, useEffect, useState } from 'react';
import { AuthContext } from 'contexts/AuthContext';
import { Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from '@mui/material';
import Dashboard, { DashboardForm } from 'types/Dashboard';
import { deleteDashboard, getAllDashboards, reconcileGeneratedDashboards } from 'services/DashboardServices';
import NavbarContext from 'contexts/NavbarContext';
import DashboardTable from 'components/dashboard/DashboardTable';
import DashboardFormModal from 'components/dashboard/DashboardFormModal';
import DashboardSectionsModal from 'components/dashboard/DashboardSectionsModal';

// Componente principal que gestiona la lista de dashboards,
// la apertura del modal para creación/edición y la interacción con la API.
const DashboardList = () => {
  const { refreshAccessKeynames } = useContext(AuthContext);
  const { changeNavTitle } = useContext(NavbarContext);
  const [deleting, setDeleting] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Estado para controlar la visibilidad del modal
  const [open, setOpen] = useState<boolean>(false);
  // Estado para almacenar el dashboard seleccionado, en caso de edición.
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | undefined>();
  // Estado que contiene la lista de dashboards obtenidos del backend.
  const [listDashboard, setListDashboard] = useState<Dashboard[]>([]);

  const [openSections, setOpenSections] = useState<boolean>(false);
  const [selectedForSections, setSelectedForSections] = useState<Dashboard | undefined>();

  // Función para abrir el modal
  const handleOpen = () => {
    setOpen(true);
  };

  // Función para cerrar el modal y limpiar la selección si existe
  const handleClose = () => {
    setSelectedDashboard(undefined);
    setOpen(false);
  };

  // Función asincrónica para obtener todos los dashboards mediante el servicio.
  const getDashboards = async () => {
    // Llama al servicio que obtiene los dashboards.
    const { data: dashboards } = await getAllDashboards();
    // Si se reciben dashboards, se actualiza el estado con la lista.
    if (dashboards) {
      setListDashboard(dashboards);
    }
  };

  // Función auxiliar para refrescar la lista de dashboards.
  const refreshListDashboards = async () => {
    await refreshAccessKeynames().catch(() => {});
    const { data: dashboards } = await getAllDashboards();
    if (dashboards) {
      setListDashboard(dashboards);
    }
  };

  // Función que se ejecuta cuando se desea editar un dashboard.
  // Recibe el dashboard a editar, lo guarda en el estado y abre el modal.
  const handleEditDashboard = (dashboard: Dashboard) => {
    setSelectedDashboard(dashboard);
    handleOpen();
  };

  // Función para abrir el modal de secciones
   const handleOpenSections = async (dashboard: Dashboard) => {
    // Actualizamos toda la lista
    const { data: dashboards } = await getAllDashboards();
    if (dashboards) {
      setListDashboard(dashboards);
      // Buscamos el dashboard actualizado por su id
      const updatedDashboard = dashboards.find(d => d._id === dashboard._id);
      if (updatedDashboard) {
        setSelectedForSections(updatedDashboard);
      } else {
        // Por si no lo encuentra (aunque no debería pasar) usamos el dashboard actual
        setSelectedForSections(dashboard);
      }
    } else {
      setSelectedForSections(dashboard);
    }
    setOpenSections(true);
  };

   const handleCloseSections = () => {
     setSelectedForSections(undefined);
     setOpenSections(false);
     refreshListDashboards();
   };

  // useEffect para cargar la lista de dashboards cuando se monta el componente.
  useEffect(() => {
    changeNavTitle('Administrar tableros');
    reconcileGeneratedDashboards().then(async () => { await getDashboards(); await refreshAccessKeynames(); })
      .catch(() => setError('No se pudo actualizar la lista de tableros. Recargá la página para reintentar.'));
  }, []);

  const handleDelete = async () => {
    if (!deleting?._id || busy) return;
    setBusy(true); setError('');
    try {
      await deleteDashboard(deleting._id);
      setListDashboard(prev => prev.filter(d => d._id !== deleting._id));
      setDeleting(null); setNotice('Tablero eliminado de la lista, el índice y el menú.');
      await refreshListDashboards();
    } catch { setError('No se pudo completar la eliminación. Reintentá; los archivos originales se conservan.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      <Typography color="text.secondary" sx={{ mb: 2 }}>El interruptor muestra u oculta el tablero. Para quitarlo de esta lista, usá Eliminar tablero completo.</Typography>
      {/* Botón para abrir el modal en modo creación de dashboard */}
      <Button variant="contained" color="primary" onClick={handleOpen}>
        Agregar Tablero
      </Button>

      {/* Modal que permite crear o editar un dashboard.
          - show: determina si el modal está visible.
          - editMode: se activa si hay un dashboard seleccionado (modo edición).
          - item: datos del dashboard a editar, castado a DashboardForm.
          - onAccept: callback que se ejecuta al guardar el formulario.
          - onClose: callback para cerrar el modal.
      */}
      <DashboardFormModal
        show={open}
        editMode={!!selectedDashboard}
        item={selectedDashboard as DashboardForm}
        onAccept={(form) => {
          console.log('Formulario recibido:', form);
          refreshListDashboards(); // Refresca la lista tras guardar cambios.
        }}
        onClose={handleClose}
      />

      {/* Tabla que muestra la lista de dashboards.
          Recibe la lista de dashboards y una función para iniciar la edición.
      */}
       <DashboardTable
        dashboards={listDashboard}
        onClickEdit={handleEditDashboard}
        onVisibilityToggle={refreshListDashboards}
        onClickSections={handleOpenSections}
        onClickDelete={setDeleting}
      />
      
      {/* Modal de Secciones */}
      <DashboardSectionsModal
        open={openSections}
        dashboard={selectedForSections as DashboardForm}
        onClose={handleCloseSections}
      />
      <Dialog open={!!deleting} onClose={busy ? undefined : () => setDeleting(null)} fullWidth maxWidth="xs">
        <DialogTitle>Eliminar tablero</DialogTitle>
        <DialogContent>
          <Typography>Se quitará «{deleting?.name || deleting?.keyname}» de la lista, el índice y el menú de todos los usuarios. Los archivos originales y las secciones usadas en otros tableros se conservan.</Typography>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions><Button disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Button><Button color="error" variant="contained" disabled={busy} onClick={handleDelete}>{busy ? 'Eliminando…' : 'Eliminar tablero completo'}</Button></DialogActions>
      </Dialog>
    </div>
  );
};

export default DashboardList;
