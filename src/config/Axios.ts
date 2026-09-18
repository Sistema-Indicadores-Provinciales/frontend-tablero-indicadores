import axios, { AxiosError, AxiosRequestConfig } from "axios";

import { API_URL } from './endpoints';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(callback: () => void) {
  onSessionExpired = callback;
}

// Cliente simple para refresh (sin interceptores)
export const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Si hay un refresh en curso, guardamos la promesa aquí para que otros esperen
let refreshPromise: Promise<string> | null = null;

function setAuthHeader(headers: any, token: string | null) {
  const name = "Authorization";
  const value = token ? `Bearer ${token}` : undefined;

  if (headers && typeof headers.set === "function") {
    if (value) headers.set(name, value);
    else headers.delete?.(name);
    return headers;
  }
  if (value) return { ...(headers || {}), [name]: value };
  const copy = { ...(headers || {}) };
  delete copy[name];
  return copy;
}

function hasAuthHeader(headers: any): boolean {
  if (!headers) return false;
  if (typeof headers.has === "function") {
    try { headers.has("Authorization"); } catch {}
  }
  const keys = Object.keys(headers || {});
  return keys.map(k => k.toLowerCase()).includes("Authorization");
}

function cloneConfigWithToken(orig: AxiosRequestConfig, token: string | null): AxiosRequestConfig {
  const origHeaders = (orig.headers && typeof orig.headers === "object") ? { ...(orig.headers as any) } : {};
  return { ...orig, headers: setAuthHeader(origHeaders, token) };
}

// LLamada al refresh
export async function doRefresh(): Promise<string> {
  const resp = await refreshClient.post("/auth/refresh", undefined, { withCredentials: true });
  const newToken = resp.data?.data?.access_token ?? resp.data?.access_token;
  if (!newToken) throw new Error("No access_token in refresh response");

  // Actualiza LocalStorage
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const user = JSON.parse(raw);
      user.access_token = newToken;
      localStorage.setItem("user", JSON.stringify(user));

    }
  } catch (e) {
    console.error("[Axios] failed to update localStorage with new token", e);
  }

  // Actualiza los headers del de apiClient
  const defaultsHeaders: any = (apiClient.defaults.headers as any) || {};
  if (defaultsHeaders && typeof defaultsHeaders.set === "function") {
    defaultsHeaders.set("Authorization", `Bearer ${newToken}`);
  } else {
    (apiClient.defaults.headers as any) = {
      ...(apiClient.defaults.headers as any || {}),
      common: { ...((apiClient.defaults.headers as any)?.common || {}), Authorization: `Bearer ${newToken}` }
    };
  }

  return newToken;
}

// Interceptor para agregar el token del LS a la request
apiClient.interceptors.request.use((config) => {
  try {
    if (hasAuthHeader(config.headers)) return config;
    const raw = localStorage.getItem("user");
    if (!raw) return config;
    const user = JSON.parse(raw);
    const token = user?.access_token ?? user?.token;
    if (token) config.headers = setAuthHeader(config.headers, token);
  } catch (e) {
    console.error("[Axios] request interceptor error", e);
  }
  return config;
});

// Interceptor para el refresh - Cuando recibe 
apiClient.interceptors.response.use(
  res => res,
  async (error: AxiosError & { config?: AxiosRequestConfig & { _retry?: boolean } }) => {
    const originalRequest = error.config!;
    const status = error.response?.status;




    if (!originalRequest) return Promise.reject(error);

    // no refresh en endpoints de auth
    if (originalRequest.url?.includes("/auth/login") ||
        originalRequest.url?.includes("/auth/register") ||
        originalRequest.url?.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    // Si la request falla, se vuelve a intentar
    if ((status === 401 || status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // si ya hay un refresh en curso, se espera esa promesa; si no, la inicia
        if (!refreshPromise) refreshPromise = doRefresh();
        const newToken = await refreshPromise;
        refreshPromise = null;

        // Se reintenta la request original con el token nuevo
        const newConfig = cloneConfigWithToken(originalRequest, newToken);
        return apiClient.request(newConfig);
      } catch (err: any) {
        refreshPromise = null;
        // Si el refresh devolvió 401/403 equivale a una sesión expirada, así que se ejecuta el logout
        const statusErr = err?.response?.status ?? err?.status;
        if (statusErr === 401 || statusErr === 403) {
          localStorage.removeItem("user");
          if (onSessionExpired) onSessionExpired();
        }
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);
