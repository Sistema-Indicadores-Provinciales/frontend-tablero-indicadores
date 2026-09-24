import { useContext, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import GoogleIcon from '@mui/icons-material/Google';
import NavbarContext from 'contexts/NavbarContext';
import { analytics, errorMessage } from 'config/Analytics';

export default function ConnectionsPage() {
  const { changeNavTitle } = useContext(NavbarContext);
  const [clientId, setClientId] = useState(''), [configured, setConfigured] = useState(false);
  const [clientSecret, setClientSecret] = useState(''), [persistent, setPersistent] = useState(false);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    changeNavTitle('Administración · Conexiones');
    const controller = new AbortController();
    setLoading(true); setError('');
    analytics.get<{ client_id: string; persistent_available?: boolean }>('/v2/google/status', { signal: controller.signal }).then(({ data }) => {
      const id = data.client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';
      setClientId(id); setConfigured(!!id);
      setPersistent(!!data.persistent_available);
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const { data } = await analytics.put('/v2/google/settings', { client_id: clientId.trim(), ...(clientSecret.trim() ? { client_secret: clientSecret.trim() } : {}) });
      setClientSecret(''); setPersistent(!!data.persistent_available);
      setConfigured(true); setNotice(data.persistent_available ? 'Conexión permanente habilitada. Cada usuario debe conectar Google una vez para guardar su autorización.' : 'Configuración guardada. Cada usuario ya puede conectar su cuenta desde el generador.');
    } catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  };
  return <Box sx={{ maxWidth: 900, mx: 'auto' }}>
    <Typography variant="overline" color="text.secondary">ADMINISTRACIÓN</Typography>
    <Typography component="h1" variant="h4" sx={{ mb: 3, color: '#003667' }}>Conexiones del sistema</Typography>
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3 }}><Stack spacing={3}>
      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap"><GoogleIcon sx={{ color: '#00558a' }} /><Typography component="h2" variant="h5">Google Sheets</Typography><Chip size="small" label={configured ? 'Cliente configurado' : 'Privadas: configuración pendiente'} /></Stack>
      <Alert severity="success">Los enlaces públicos ya funcionan sin configurar una cuenta de Google.</Alert>
      <Typography>Para usar hojas privadas, un administrador debe habilitar esta conexión una sola vez. Después, cada usuario elige su cuenta y autoriza la lectura desde el generador.</Typography>
      {loading && <Typography role="status">Cargando configuración…</Typography>}
      {error && <Alert severity="error" action={<Button onClick={() => setRetry(v => v + 1)}>Reintentar</Button>}>{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      <Box component="ol" sx={{ pl: 3, my: 0, '& li': { mb: 1 } }}>
        <li>Abrí un proyecto en Google Cloud y habilitá Google Sheets API.</li>
        <li>Configurá Google Auth Platform y agregá las cuentas de prueba si la aplicación está en modo de prueba.</li>
        <li>Creá un cliente OAuth de tipo Aplicación web.</li>
        <li>Agregá <strong>{window.location.origin}</strong> en Orígenes de JavaScript autorizados. Incluí también http://localhost:5173 y http://localhost:5174 para desarrollo, y el dominio HTTPS cuando publiques el sistema.</li>
        <li>Copiá el ID del cliente y pegalo abajo. Para mantener las cuentas conectadas, copiá también el secreto de ese mismo cliente.</li>
      </Box>
      <Link href="https://developers.google.com/workspace/sheets/api/quickstart/js" target="_blank" rel="noopener noreferrer">Abrir la guía de Google</Link>
      <TextField label="ID de cliente OAuth" value={clientId} onChange={e => setClientId(e.target.value)} disabled={loading || saving} fullWidth placeholder="…apps.googleusercontent.com" helperText="Usá solo el identificador público. No pegues contraseñas, tokens ni el secreto del cliente." />
      <TextField label="Secreto del cliente OAuth" type="password" autoComplete="new-password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} disabled={loading || saving} fullWidth helperText={persistent ? 'Ya hay un secreto configurado. Dejá este campo vacío para conservarlo, o ingresá uno nuevo para reemplazarlo.' : 'Se guarda cifrado en el servidor y no vuelve a mostrarse. No es tu contraseña de Google.'} />
      <Alert severity={persistent ? 'success' : 'info'}>{persistent ? 'Las cuentas pueden permanecer conectadas por usuario.' : 'Falta el secreto del cliente para mantener las cuentas conectadas después de recargar.'}</Alert>
      <Typography variant="body2" color="text.secondary">Si el proyecto de Google sigue en modo de prueba, Google vence estas autorizaciones a los 7 días. Al vencer, cada usuario tendrá que renovar la conexión.</Typography>
      <Typography variant="body2" color="text.secondary">El ID se guarda para todo el sistema. No hace falta reiniciar los servicios.</Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap><Button variant="contained" onClick={save} disabled={loading || saving || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId.trim())}>{saving ? 'Guardando…' : 'Guardar configuración'}</Button><Button component={RouterLink} to="/generador">Ir al generador</Button></Stack>
    </Stack></Paper>
  </Box>;
}
