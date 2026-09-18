import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import DashboardIcon from '@mui/icons-material/Dashboard'
import Dashboard from 'types/Dashboard';
import { sendEditDashboard } from 'services/DashboardServices';
import { Icon } from '@iconify/react';

// Se extiende la interfaz de propiedades para incluir un callback que permita notificar
// al componente padre sobre el cambio en la visibilidad.
interface DashboardTableProps {
  dashboards: Dashboard[];
  onClickEdit?: (item: Dashboard) => any;
  onClickDelete?: (item: Dashboard) => any;
  onVisibilityToggle?: () => any; // Callback para refrescar la lista o actualizar la visibilidad
  onClickSections?: (item: Dashboard) => any;  // <-- nueva prop
}

const DashboardTable: React.FC<DashboardTableProps> = (props) => {

  // Función para manejar el cambio del Switch de visibilidad.
  // Recibe el dashboard a modificar y el evento para determinar el nuevo valor.
  const handleSwitchChange = async (
    dashboard: Dashboard,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newShow = event.target.checked; // Nuevo estado de visibilidad
    try {
      // Llama al servicio para actualizar la visibilidad.
      // Se pasa undefined en newKeyname para indicar que no se quiere modificar el nombre.
      await sendEditDashboard(dashboard._id!, newShow);

      // Si se ha definido un callback onVisibilityToggle, se invoca para que el componente
      // padre pueda refrescar o actualizar la lista de dashboards.
      if (props.onVisibilityToggle) {
        props.onVisibilityToggle();
      }
    } catch (error) {
      console.error(
        `Error al actualizar la visibilidad del dashboard ${dashboard.keyname}:`,
        error
      );
    }
  };

  // Función para manejar la acción de editar el dashboard.
  const handleEdit = (dashboard: Dashboard) => {
    if (dashboard && props.onClickEdit) {
      props.onClickEdit(dashboard);
    }
  };

  // Función para manejar la acción de eliminar el dashboard.
  const handleDelete = (dashboard: Dashboard) => {
    if (dashboard && props.onClickDelete) {
      props.onClickDelete(dashboard);
    }
  };

  return (
    <TableContainer component={Paper} style={{ marginTop: 20 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Nombre</TableCell>
            <TableCell>Visible</TableCell>
            <TableCell align="center" width={'160px'}>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.dashboards.map((dashboard, index) => (
            <TableRow key={index}>
                <TableCell>
                  {dashboard.icon && (
                    <Icon
                      icon={dashboard.icon}
                      style={{ fontSize: '24px', marginRight: '8px', verticalAlign: 'middle' }}
                    />
                  )}
                  {dashboard.name || dashboard.keyname}
                </TableCell>
                <TableCell>
                {/* El Switch ahora es interactivo: al cambiar su valor se llama a handleSwitchChange */}
                <Switch
                  checked={dashboard.show}
                  onChange={(event) => handleSwitchChange(dashboard, event)}
                />
              </TableCell>
              <TableCell align="center">
                {/* Botón Editar */}
                {props.onClickEdit && (
                  <IconButton aria-label={`Editar ${dashboard.name || dashboard.keyname}`} title="Editar tablero" color="primary" onClick={() => handleEdit(dashboard)}>
                    <EditIcon />
                  </IconButton>
                )}
                {/* Botón Secciones */}
                {props.onClickSections && (
                  <IconButton
                    aria-label={`Secciones de ${dashboard.name || dashboard.keyname}`}
                    title="Administrar secciones"
                    color="secondary"
                    onClick={() => props.onClickSections!(dashboard)}
                  >
                    <DashboardIcon />  {/* importar: import DashboardIcon from '@mui/icons-material/Dashboard'; */}
                  </IconButton>
                )}
                {/* Botón Eliminar si existe */}
                {props.onClickDelete && (
                  <IconButton aria-label={`Eliminar ${dashboard.name || dashboard.keyname}`} title="Eliminar tablero completo" color="error" onClick={() => handleDelete(dashboard)}>
                    <DeleteIcon />
                  </IconButton>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DashboardTable;
