import { useContext, useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import User from 'types/User';
import UserFormModal from 'components/user/UserFormModal';
import { getAllUsers, deleteUser } from 'services/UserServices';
import TableItems from 'components/user/TableItems';
import UserAccessModal from 'components/user/UserAccessModal';
import NavbarContext from 'contexts/NavbarContext';

const UserList = () => {
  const { changeNavTitle } = useContext(NavbarContext);
  const [open, setOpen] = useState<boolean>(false);
  const [openAccess, setOpenAccess] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | undefined>();
  const [listUsers, setListUsers] = useState<User[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setSelectedUser(undefined)
    setOpen(false)
  }

  const handleOpenAccess = (user: User) => {
    setSelectedUser(user);
    setOpenAccess(true);
  };

  const handleCloseAccess = () => {
    setSelectedUser(undefined);
    setOpenAccess(false);
  }


  const getUsuarios = async () => {
    const { data } = await getAllUsers();
    if (data) {
      setListUsers(data)
    }
  }

  const refreshListUsers = () => {
    getUsuarios()
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    handleOpen()
  }

  const handleDeleteUser = async (user: User) => {
    setSelectedUser(user);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    try {
      await deleteUser(selectedUser.username, selectedUser.email);
      setListUsers((prevUsers) => prevUsers.filter((u) => u.username !== selectedUser.username));
      setConfirmDeleteOpen(false);
      setSelectedUser(undefined);
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteOpen(false);
    setSelectedUser(undefined);
  };

  useEffect(() => {
    changeNavTitle('Administrar usuarios');
    getUsuarios()
  }, [])

  return (
    <div>
      <Button variant="contained" color="primary" onClick={handleOpen}>
        Agregar Usuario
      </Button>

      <UserFormModal show={open} item={selectedUser} onAccept={refreshListUsers} onClose={handleClose} />
      <TableItems
        users={listUsers}
        onClickEdit={handleEditUser}
        onClickDashboards={handleOpenAccess}
        onClickDelete={handleDeleteUser}
        onCancelDelete={handleCancelDelete}
      />
      <Dialog open={confirmDeleteOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de eliminar al usuario <strong>{selectedUser?.username}</strong>? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">Cancelar</Button>
          <Button onClick={handleConfirmDelete} color="error">Eliminar</Button>
        </DialogActions>
      </Dialog>
      <UserAccessModal show={openAccess} item={selectedUser} onAccept={refreshListUsers} onClose={handleCloseAccess}/>
    </div>
  );
};

export default UserList;
