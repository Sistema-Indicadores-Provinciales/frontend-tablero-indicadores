import axios from 'axios';
import { ANALYTICS_URL } from './endpoints';
import { doRefresh } from './Axios';

export const analytics = axios.create({ baseURL: ANALYTICS_URL, timeout: 90000 });
let refresh: Promise<string> | null = null;
analytics.interceptors.request.use(config => {
  const stored = localStorage.getItem('user');
  try {
    const user = stored ? JSON.parse(stored) : null;
    const token = user?.access_token ?? user?.token;
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  } catch { /* Login handles an invalid stored session. */ }
  return config;
});
analytics.interceptors.response.use(response => response, async error => {
  if (error.response?.status === 401 && error.config && !error.config._retry) {
    error.config._retry = true;
    try {
      if (!refresh) refresh = doRefresh().finally(() => { refresh = null; });
      await refresh;
      return analytics.request(error.config);
    } catch { return Promise.reject(error); }
  }
  return Promise.reject(error);
});
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return 'Revisá los campos de configuración.';
    if (error.response?.status === 401) return 'La sesión venció. Volvé a ingresar.';
    return 'No se pudo completar la operación. Verificá la conexión e intentá de nuevo.';
  }
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}
