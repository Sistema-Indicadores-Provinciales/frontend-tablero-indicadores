import { Box, Button, TextField, Typography, Container, Alert, Collapse } from '@mui/material';
import ThemeToggle from 'components/base/ThemeToggle';
import { AuthContext } from 'contexts/AuthContext';
import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendAuthLogin } from 'services/AuthServices';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { loginUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSendLogin = async () => {
    if (busy || !username.trim() || !password) return;
    setBusy(true); setError('');
    try {
      const { error, data, success } = await sendAuthLogin(username.trim(), password);
      if (success && data) {
        await loginUser(data).catch(() => {});
        navigate('/main', { replace: true });
      } else {
        setError(error || 'No se pudo conectar con el sistema. Verificá que el backend esté iniciado y volvé a intentar.');
      }
    } catch { setError('No se pudo iniciar sesión. Volvé a intentar.'); }
    finally { setBusy(false); }
  }

  return (
    <Container
      maxWidth={false}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100dvh',
        position: 'relative',
        backgroundColor: 'background.default',
      }}
    >
      <Box sx={{ position: 'absolute', top: 2, right: 2 }}>
        <ThemeToggle />
      </Box>
      <Box
        component="form"
        onSubmit={event => { event.preventDefault(); handleSendLogin(); }}
        sx={{
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          backgroundColor: 'background.paper',
          borderRadius: '8px',
          boxShadow: theme => theme.shadows[3],
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Ingresar al tablero
        </Typography>
        <TextField
          label="Usuario"
          autoComplete="username"
          required
          disabled={busy}
          variant="outlined"
          fullWidth
          margin="normal"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <TextField
          label="Contraseña"
          autoComplete="current-password"
          required
          disabled={busy}
          variant="outlined"
          fullWidth
          margin="normal"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Collapse in={!!error}>
          <Alert severity="error">{error || ''}</Alert>
        </Collapse>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          sx={{ marginTop: '1rem' }}
          type="submit"
          disabled={busy || !username.trim() || !password}
        >
          {busy ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </Box>
    </Container>
  );
}

export default LoginPage
