import { useContext, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Link, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import GoogleIcon from '@mui/icons-material/Google';
import { isAxiosError } from 'axios';
import { AuthContext } from 'contexts/AuthContext';
import { analytics, errorMessage } from 'config/Analytics';
import { connectGoogle, disconnectGoogle, loadGoogleIdentity } from 'config/googleSheets';

interface Settings { client_id: string; public_access: boolean; }
interface Props { token: string; onToken: (token: string) => void; busy?: boolean; onUseSheet?: (url: string, token: string) => Promise<void>; }

export default function GoogleConnectionPanel({ token, onToken, busy = false, onUseSheet }: Props) {
  const { profileType } = useContext(AuthContext);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [ready, setReady] = useState(false), [working, setWorking] = useState(false);
  const [error, setError] = useState(''), [settingsError, setSettingsError] = useState('');
  const [url, setUrl] = useState('');
  const [needsAccount, setNeedsAccount] = useState(!onUseSheet);
  const [retry, setRetry] = useState(0);
  const configuredId = settings?.client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';
  const isAdmin = profileType === 'ADMIN';

  useEffect(() => {
    const controller = new AbortController();
    setSettingsError('');
    analytics.get<Settings>('/v2/google/status', { signal: controller.signal }).then(({ data }) => setSettings(data))
      .catch(e => { if (!controller.signal.aborted) setSettingsError(errorMessage(e)); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    setReady(false);
    if (!configuredId) return;
    let active = true;
    loadGoogleIdentity().then(() => { if (active) setReady(true); }).catch(e => { if (active) setSettingsError(errorMessage(e)); });
    return () => { active = false; };
  }, [configuredId, retry]);

  const useSheet = async (accessToken: string) => {
    if (!onUseSheet || !url.trim()) return;
    setError('');
    try {
      await onUseSheet(url.trim(), accessToken);
      setNeedsAccount(false);
    } catch (e) {
      setError(errorMessage(e));
      // Published links cannot be opened with OAuth; users need to check their publication instead.
      setNeedsAccount(!url.includes('/d/e/') && isAxiosError(e) && e.response?.status === 409);
    }
  };
  const useLink = async () => {
    setWorking(true);
    try { await useSheet(token); } finally { setWorking(false); }
  };
  const connect = () => {
    setError(''); setWorking(true);
    // Start consent directly inside the click, before any HTTP request.
    connectGoogle(configuredId).then(async value => {
      onToken(value);
      await useSheet(value);
    }).catch(e => setError(errorMessage(e))).finally(() => setWorking(false));
  };
  return <Box component="section" aria-label="Google Sheets" sx={{ p: 2.5, mt: 2, border: '1px solid #dbe3ec', borderRadius: 2, bgcolor: '#f7fafc' }}>
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Typography variant="h6" component="h3" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><GoogleIcon sx={{ color: '#00558a' }} /> Google Sheets</Typography>
        {token && <Chip size="small" color="success" label="Cuenta conectada" />}
      </Stack>
      <Typography variant="body2">{onUseSheet ? 'Pegá el enlace de la pestaña que querés usar. Si es pública, podés continuar sin conectar una cuenta.' : 'Para leer esta hoja privada, conectá una cuenta de Google que tenga acceso.'}</Typography>
      {onUseSheet && <TextField label="Enlace de Google Sheets" value={url} onChange={e => { setUrl(e.target.value); setError(''); setNeedsAccount(false); }} placeholder="Pegá aquí el enlace de tu hoja" fullWidth size="small" disabled={busy || working} />}
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" gap={1.5} flexWrap="wrap">
        {onUseSheet && <Button variant="contained" disabled={busy || working || !url.trim()} onClick={useLink} sx={{ bgcolor: '#003667' }}>{working ? 'Cargando…' : 'Usar hoja'}</Button>}
        {configuredId && !token && <Button variant={onUseSheet ? 'outlined' : 'contained'} startIcon={<GoogleIcon />} disabled={!ready || busy || working} onClick={connect}>{!ready ? 'Preparando Google…' : 'Conectar Google'}</Button>}
        {token && <Button disabled={!ready || busy || working} onClick={connect}>Cambiar / renovar cuenta</Button>}
        {token && <Button disabled={busy || working} onClick={() => { disconnectGoogle(token); onToken(''); }}>Desconectar cuenta</Button>}
      </Stack>
      {settingsError && <Alert severity="warning" action={<Button onClick={() => setRetry(v => v + 1)}>Reintentar</Button>}>No se pudo preparar la conexión de cuentas Google. Podés seguir usando enlaces públicos.</Alert>}
      {needsAccount && settings && !configuredId && <Alert severity="info">
        El acceso a hojas privadas todavía no está habilitado. {isAdmin ? <Link component={RouterLink} to="/administracion/conexiones">Habilitarlo desde Administración → Conexiones</Link> : 'Un administrador debe habilitarlo desde Administración → Conexiones.'}
      </Alert>}
      {configuredId && !token && <Typography variant="body2" color="text.secondary">Si la hoja es privada, usá Conectar Google y autorizá su lectura.</Typography>}
      {onUseSheet && <Box component="details"><Typography component="summary" variant="body2" sx={{ cursor: 'pointer', color: '#00558a' }}>Cómo usar un enlace público</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>Podés usar una hoja que permita lectura a cualquier persona con el enlace, o el enlace de Archivo → Compartir → Publicar en la Web. Se vincula la pestaña indicada; si el enlace no indica una, se usa la primera disponible. Para otra pestaña, pegá su enlace.</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>Mantené privadas las hojas que necesiten acceso restringido y usá Conectar Google para leerlas.</Typography>
      </Box>}
      <Typography variant="body2" color="text.secondary">Solo se lee la hoja. Los datos se consultan nuevamente al generar o actualizar los gráficos.</Typography>
    </Stack>
  </Box>;
}
