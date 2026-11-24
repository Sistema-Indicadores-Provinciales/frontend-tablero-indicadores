import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogProps, DialogTitle, MenuItem, Select, TextField } from '@mui/material';
import User, { UserForm } from 'types/User';
import { sendCreateUser } from 'services/UserServices';

interface UserFormModalProps {
  item?: User;
  show: boolean;
  editMode?: boolean;
  onAccept: () => any
  onClose: () => any
}

const UserFormModal: React.FC<UserFormModalProps> = (props) => {
  const [form, setForm] = useState<Partial<UserForm>>(() => new UserForm({}))
  const [isEdit, setIsEdit] = useState<boolean>(false)

  const handleChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name as string]: value }))
  };  

  const handleAccept = async () => {
    const user = Object.assign({}, form);
    const userCreated = await sendCreateUser(user as UserForm)
    if (userCreated) {
      props.onClose()
      props.onAccept()
    }
  }
  

  const handleModalOnClose: DialogProps["onClose"] = (_, reason) => {
    if (reason && reason === "backdropClick")
      return;
    handleClose()
  }

  const handleClose = () => {
    props.onClose()
  }

  useEffect(() => {
    if (props.item) {
      setIsEdit(true)
      setForm(new UserForm(props.item))
    } else {
      setIsEdit(false)
      setForm(new UserForm({}))
    }
  }, [props.item])

  return (
    <Dialog open={props.show} onClose={handleModalOnClose}>
      <DialogTitle>{props.editMode ? 'Editar Usuario' : 'Agregar Usuario'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          name="username"
          label="Nombre"
          type="text"
          fullWidth
          value={form?.username}
          onChange={handleChange}
        />
        {
          !isEdit && (
            <TextField
              margin="dense"
              name="password"
              label="Contraseña"
              type="password"
              fullWidth
              value={form?.password}
              onChange={handleChange}
            />
          )
        }
        <Select
          margin='dense'
          label="Tipo de usuario"
          name="profileType"
          value={form?.profileType || ''}
          onChange={(event) => handleChange(event as React.ChangeEvent<{ name?: string; value: unknown }>)}
          displayEmpty
        >
          <MenuItem value="" disabled>
            Seleccionar tipo de usuario
          </MenuItem>
          <MenuItem value="ADMIN">Administrador</MenuItem>
          <MenuItem value="INVITADO">Invitado</MenuItem>
        </Select>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">Cancelar</Button>
        <Button onClick={handleAccept} color="primary">Guardar</Button>
      </DialogActions>
    </Dialog>
  )
}

export default UserFormModal
