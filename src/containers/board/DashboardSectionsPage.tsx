import { useContext, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Card, CardActionArea, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { Icon } from '@iconify/react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from 'contexts/AuthContext';
import { analytics, errorMessage } from 'config/Analytics';
import Dashboard from 'types/Dashboard';
import Sections from 'types/Sections';
import { DestinationOption, Publication } from 'types/Generator';
import Indexer from 'containers/common/Indexer';

export default function DashboardSectionsPage({ dashboard, sections }: { dashboard: Dashboard; sections: Sections[] }) {
  const { profileType, refreshAccessKeynames } = useContext(AuthContext);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [name, setName] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [options, setOptions] = useState<Publication | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const requestId = useRef('');
  const load = async () => {
    setError(''); setOptions(null);
    try {
      const { data } = await analytics.get<Publication>(`/v2/dashboards/${dashboard._id}/section-options`);
      setOptions(data); setRecipients([data.currentUserId]);
    } catch (e) { setError(errorMessage(e)); }
  };
  const start = () => { requestId.current = crypto.randomUUID(); setName(''); setNotice(''); setOpen(true); void load(); };
  const create = async () => {
    if (busy || !options || !name.trim()) return;
    setBusy(true); setError('');
    try {
      const { data } = await analytics.post<DestinationOption & { canView: boolean }>(`/v2/dashboards/${dashboard._id}/sections`, {
        name: name.trim(), recipientIds: recipients, requestId: requestId.current,
      });
      await refreshAccessKeynames();
      setOpen(false);
      if (data.canView) navigate(data.path);
      else setNotice('Sección creada con los accesos elegidos. Tu usuario no tiene acceso para abrirla.');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  return <Box>
    <Button component={Link} to="/main" startIcon={<Icon icon="material-symbols:arrow-back" />}>Volver al índice</Button>
    <Box sx={{ my: 3, p: 3, borderRadius: 2, background: 'linear-gradient(110deg, #003667, #00558a)', color: 'white' }}>
      <Typography variant="overline">TABLERO</Typography><Typography variant="h4" component="h1">{dashboard.name || dashboard.keyname}</Typography>
      <Typography sx={{ mt: 1 }}>Elegí una sección para ver sus gráficos.{profileType === 'ADMIN' && ' También podés crear una sección y elegir quién puede verla.'}</Typography>
    </Box>
    {notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}
    {!sections.length && <Typography color="text.secondary" sx={{ mb: 3 }}>{profileType === 'ADMIN' ? 'Todavía no hay secciones visibles para vos. Agregá una sección para comenzar.' : 'Todavía no hay secciones disponibles para tu usuario.'}</Typography>}
    <Indexer title={dashboard.name || dashboard.keyname} routes={sections.map(s => ({
      path: `/${dashboard.keyname}/${s.keyname}`, keyname: s.keyname, title: s.name || s.keyname, icon: dashboard.icon, show: s.show,
    }))} action={profileType === 'ADMIN' && <Card variant="outlined" sx={{ height: 180, border: '2px dashed #8aaac2', bgcolor: '#f5f9fc' }}>
      <CardActionArea onClick={start} sx={{ height: '100%', p: 2, textAlign: 'center', color: '#003667' }}>
        <Icon icon="material-symbols:add-circle-outline" width={48} /><Typography fontWeight="bold">Agregar sección</Typography><Typography variant="body2" sx={{ mt: 1 }}>Nombre, accesos y gráficos</Typography>
      </CardActionArea>
    </Card>} />
    <Dialog open={open} onClose={busy ? undefined : () => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="new-section-title">
      <DialogTitle id="new-section-title" sx={{ bgcolor: '#003667', color: 'white' }}>Agregar sección</DialogTitle>
      <DialogContent><Stack spacing={3} sx={{ pt: 3 }}>
        <Typography>Tablero: <strong>{dashboard.name || dashboard.keyname}</strong>. Después de crear la sección, podrás agregar sus gráficos.</Typography>
        {error && <Alert severity="error" action={!options ? <Button onClick={load}>Reintentar</Button> : undefined}>{error}</Alert>}
        <TextField autoFocus label="Nombre de la sección" value={name} onChange={e => setName(e.target.value)} disabled={busy} inputProps={{ maxLength: 200 }} />
        {options ? <Autocomplete multiple disableCloseOnSelect options={options.users} disabled={busy}
          value={options.users.filter(u => recipients.includes(u._id))} getOptionLabel={u => u.username + (u._id === options.currentUserId ? ' (vos)' : '')}
          isOptionEqualToValue={(a, b) => a._id === b._id} onChange={(_, users) => setRecipients(users.map(u => u._id))}
          renderInput={params => <TextField {...params} label="Quién puede ver esta sección" placeholder="Buscar usuario" helperText="Estos accesos se aplican solo a esta sección y también se pueden cambiar desde Usuarios." />} />
          : !error && <Typography role="status">Cargando usuarios…</Typography>}
        {options && !recipients.length && <Alert severity="info">La sección quedará sin lectores hasta que asignes un usuario.</Alert>}
      </Stack></DialogContent>
      <DialogActions sx={{ p: 3 }}><Button disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button variant="contained" disabled={busy || !options || !name.trim()} onClick={create}>{busy ? 'Creando…' : 'Crear sección'}</Button></DialogActions>
    </Dialog>
  </Box>;
}
