let scriptPromise: Promise<void> | null = null;
interface TokenResponse { access_token?: string; error?: string; scope?: string; }
interface GoogleIdentity { accounts: { oauth2: { initCodeClient(options: {
  client_id: string; scope: string; ux_mode: 'popup'; select_account: boolean;
  callback: (response: { code?: string; error?: string }) => void; error_callback: () => void;
}): { requestCode(): void }; initTokenClient(options: {
  client_id: string; scope: string; callback: (response: TokenResponse) => void;
  error_callback: () => void;
}): { requestAccessToken(): void }; revoke(token: string, callback: () => void): void } } }
function identity(): GoogleIdentity | undefined {
  return (window as unknown as { google?: GoogleIdentity }).google;
}
export function loadGoogleIdentity(): Promise<void> {
  if (identity()?.accounts?.oauth2) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timeout = window.setTimeout(() => { script.remove(); scriptPromise = null; reject(new Error('Google tardó demasiado en responder. Reintentá la conexión.')); }, 15000);
    script.onload = () => { window.clearTimeout(timeout); if (identity()?.accounts?.oauth2) resolve(); else { script.remove(); scriptPromise = null; reject(new Error('No se pudo iniciar la conexión con Google.')); } };
    script.onerror = () => { window.clearTimeout(timeout); script.remove(); scriptPromise = null; reject(new Error('No se pudo cargar la conexión con Google.')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}
// Invoked synchronously from a user click so browsers permit the consent popup.
export function connectGoogle(clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()): Promise<string> {
  if (!clientId) return Promise.reject(new Error('Un administrador debe habilitar la conexión con Google.'));
  const google = identity();
  if (!google?.accounts?.oauth2) return Promise.reject(new Error('Google todavía está cargando. Intentá nuevamente.'));
  return new Promise((resolve, reject) => {
    google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      callback: response => response.access_token ? resolve(response.access_token) : reject(new Error('Google no autorizó la lectura de hojas.')),
      error_callback: () => reject(new Error('La ventana de Google se cerró o fue bloqueada.')),
    }).requestAccessToken();
  });
}
export function disconnectGoogle(token: string) { identity()?.accounts?.oauth2.revoke(token, () => {}); }

// The server exchanges this one-time code; Google tokens never reach browser storage.
export function authorizeGoogle(clientId: string): Promise<string> {
  const google = identity();
  if (!google?.accounts?.oauth2) return Promise.reject(new Error('Google todavía está cargando. Intentá nuevamente.'));
  return new Promise((resolve, reject) => {
    google.accounts.oauth2.initCodeClient({
      client_id: clientId, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      ux_mode: 'popup', select_account: true,
      callback: response => response.code ? resolve(response.code) : reject(new Error('Google no autorizó la lectura de hojas.')),
      error_callback: () => reject(new Error('La ventana de Google se cerró o fue bloqueada.')),
    }).requestCode();
  });
}
