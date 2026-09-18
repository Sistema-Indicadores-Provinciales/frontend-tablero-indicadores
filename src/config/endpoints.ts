const local = (port: string) => `${window.location.protocol}//${window.location.hostname}:${port}`;
export const API_URL = import.meta.env.VITE_APP_SERVER_URL || (import.meta.env.PROD ? '/api' : local(import.meta.env.VITE_APP_SERVER_PORT || '3000'));
export const ANALYTICS_URL = import.meta.env.VITE_FASTAPI_URL || (import.meta.env.PROD ? '/analytics' : local(import.meta.env.VITE_FASTAPI_PORT || '8000'));
