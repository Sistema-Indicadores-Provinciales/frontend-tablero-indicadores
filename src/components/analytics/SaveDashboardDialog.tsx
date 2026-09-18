import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Icon } from '@iconify/react';
import { analytics, errorMessage } from 'config/Analytics';
import { DestinationOption, Publication, SectionOptions } from 'types/Generator';

const icons = [
  ['material-symbols:bar-chart-rounded', 'Gráficos'], ['material-symbols:dashboard-rounded', 'Tablero'],
  ['material-symbols:monitoring-rounded', 'Evolución'], ['material-symbols:account-balance-rounded', 'Economía'],
  ['material-symbols:health-and-safety-rounded', 'Salud'], ['material-symbols:school-rounded', 'Educación'],
];
interface Props {
  open: boolean; workspaceId: string; name: string; busy: boolean; error: string; count: number;
  destination?: DestinationOption | null;
  onClose: () => void; onSave: (name: string, icon: string, recipients?: string[], destination?: DestinationOption) => Promise<void>;
}

export default function SaveDashboardDialog({ open, workspaceId, name, busy, error, count, destination, onClose, onSave }: Props) {
  const [options, setOptions] = useState<Publication | null>(null);
  const [loadError, setLoadError] = useState('');
  const [title, setTitle] = useState(name);
  const [icon, setIcon] = useState(icons[0][0]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [retry, setRetry] = useState(0);
  const [target, setTarget] = useState<DestinationOption | null>(null);
  const [choosing, setChoosing] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setTitle(name); setOptions(null); setLoadError(''); setSearch(''); setChoosing(true);
    analytics.get<Publication>(workspaceId ? `/v2/workspaces/${workspaceId}/publication` : '/v2/publication-options', { signal: controller.signal })
      .then(async ({ data }) => {
        if (controller.signal.aborted) return;
        setOptions(data); setIcon(data.icon || icons[0][0]);
        setRecipients(data.published ? data.recipientIds : [data.currentUserId]);
        const selected = data.destination || destination || null;
        setTarget(selected);
        if (selected && !data.published) {
          const response = await analytics.get<SectionOptions>(`/v2/dashboards/${selected.dashboardId}/sections/${selected.sectionId}/options`, { signal: controller.signal });
          if (controller.signal.aborted) return;
          if (!response.data.canAddCharts) throw new Error('La sección ya tiene gráficos. Abrila para editarlos.');
          setRecipients(response.data.recipientIds); setTitle(selected.sectionName);
        }
      }).catch(e => { if (!controller.signal.aborted) setLoadError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setChoosing(false); });
    return () => controller.abort();
    // A workspace ID assigned during saving must not reset an open form or its error.
  }, [open, retry]);
  const selectTarget = async (key: string) => {
    const selected = options?.destinations?.find(d => `${d.dashboardId}/${d.sectionId}` === key) || null;
    setTarget(selected); setLoadError(''); setChoosing(true);
    try {
      if (selected) {
        const { data } = await analytics.get<SectionOptions>(`/v2/dashboards/${selected.dashboardId}/sections/${selected.sectionId}/options`);
        if (!data.canAddCharts) throw new Error('La sección ya tiene gráficos. Abrila para editarlos.');
        setRecipients(data.recipientIds); setTitle(selected.sectionName);
      } else { setTitle(name); setRecipients(options ? [options.currentUserId] : []); }
    } catch (e) { setLoadError(errorMessage(e)); }
    finally { setChoosing(false); }
  };
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="save-dashboard-title">
    <DialogTitle id="save-dashboard-title" sx={{ background: 'linear-gradient(to right, #003667, #00558a)', color: 'white' }}>{target ? 'Guardar gráficos en la sección' : 'Guardar tablero en el menú'}</DialogTitle>
    <DialogContent sx={{ pt: '24px !important' }}>
      <Stack spacing={3}>
        <Typography color="text.secondary">{count} {count === 1 ? 'gráfico' : 'gráficos'} · Aparecerá en el menú lateral y en el índice de quienes tengan acceso.</Typography>
        {(loadError || error) && <Alert severity="error" action={loadError ? <Button onClick={() => setRetry(v => v + 1)}>Reintentar</Button> : undefined}>{loadError || error}</Alert>}
        {!options && !loadError && <Typography role="status">Cargando accesos…</Typography>}
        {!workspaceId && !destination && !!options?.canShare && <TextField select label="Dónde guardar los gráficos" value={target ? `${target.dashboardId}/${target.sectionId}` : ''} onChange={e => void selectTarget(e.target.value)} disabled={busy || choosing}>
          <MenuItem value="">Crear un tablero nuevo</MenuItem>
          {options.destinations?.map(d => <MenuItem key={`${d.dashboardId}/${d.sectionId}`} value={`${d.dashboardId}/${d.sectionId}`}>{d.dashboardName} → {d.sectionName}</MenuItem>)}
        </TextField>}
        {target ? <Alert severity="info">Tablero: <strong>{target.dashboardName}</strong><br />Sección: <strong>{target.sectionName}</strong><br />Los gráficos se guardarán aquí. El nombre del tablero y las otras secciones se conservan.</Alert>
          : <TextField label="Nombre en el menú" value={title} onChange={e => setTitle(e.target.value)} inputProps={{ maxLength: 200 }} disabled={busy} fullWidth />}
        {!target && <Box><Typography variant="subtitle2" gutterBottom>Ícono del tablero</Typography>
          <ToggleButtonGroup value={icon} exclusive onChange={(_, value) => { if (value) setIcon(value); }} disabled={busy} aria-label="Ícono del tablero" sx={{ flexWrap: 'wrap' }}>
            {icons.map(([value, label]) => <ToggleButton key={value} value={value} aria-label={label} title={label}><Icon icon={value} width={26} /></ToggleButton>)}
          </ToggleButtonGroup>
        </Box>}
        {options?.canShare ? <Box><Typography variant="subtitle2" gutterBottom>{target ? 'Quién puede ver esta sección' : 'Quién puede verlo'}</Typography>
          <Autocomplete multiple disableCloseOnSelect options={options.users} value={options.users.filter(u => recipients.includes(u._id))}
            inputValue={search} onInputChange={(_, value) => setSearch(value)} disabled={busy || choosing}
            getOptionLabel={u => u.username + (u._id === options.currentUserId ? ' (vos)' : '')}
            isOptionEqualToValue={(a, b) => a._id === b._id}
            onChange={(_, users) => setRecipients(users.map(u => u._id))}
            renderInput={params => <TextField {...params} label="Usuarios con acceso" placeholder="Buscar usuario" />}
            renderTags={(users, getTagProps) => users.map((u, i) => { const { key, ...props } = getTagProps({ index: i }); return <Chip key={key} {...props} label={u.username + (u._id === options.currentUserId ? ' (vos)' : '')} size="small" />; })}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>También podés cambiar estos accesos desde Usuarios, como en los demás tableros.</Typography>
          {!recipients.length && <Alert severity="info" sx={{ mt: 1 }}>Nadie lo verá en el menú hasta que asignes un usuario.</Alert>}
        </Box> : options && <Alert severity="info">Tu tablero se guarda con acceso para vos. Un administrador puede habilitarlo para otros usuarios desde Usuarios.</Alert>}
        {options?.published && !options.show && <Alert severity="warning">Este tablero o su sección están deshabilitados. Un administrador debe habilitarlos desde Tableros para que aparezcan en el menú.</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 3 }}>
      <Button disabled={busy} onClick={onClose}>Cancelar</Button>
      <Button variant="contained" sx={{ bgcolor: '#003667' }} disabled={busy || choosing || !!loadError || !options || !title.trim()} onClick={() => onSave(target?.sectionName || title.trim(), icon, options?.canShare ? recipients : undefined, target || undefined)}>{busy ? 'Guardando…' : 'Guardar y aplicar accesos'}</Button>
    </DialogActions>
  </Dialog>;
}
