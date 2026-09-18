import { apiClient } from "config/Axios";
import { DataResponse } from "types/Response";
import User from "types/User";
import responseFormatter from "utils/responseFormatter";

export const sendAuthLogin = async (
  username: string,
  password: string
): Promise<DataResponse<User>> => {
  const response = await responseFormatter(
    apiClient.post('/auth/login', { username, password })
  );

  if (response.success) {
    const token = response.data?.access_token;
    if (!token || typeof token !== 'string') return { success: false, error: 'El servidor no devolvió una sesión válida.' };
    apiClient.defaults.headers['Authorization'] = `Bearer ${token}`;

    const resUser = await responseFormatter(apiClient.get('/user'));

    if (resUser.success) {
      const user: User = resUser.data;
      user.access_token = token;
      localStorage.setItem('user', JSON.stringify(user)); // solo guardamos user + access
      response.data = user;
    } else {
      delete apiClient.defaults.headers['Authorization'];
      return { success: false, error: typeof resUser.error === 'string' ? resUser.error : 'No se pudo cargar tu usuario. Volvé a intentar.' };
    }
  } else if (typeof response.error !== 'string') {
    response.error = response.status === 401 ? 'Usuario o contraseña no válidos.' : 'No se pudo conectar con el sistema. Verificá que el backend esté iniciado y volvé a intentar.';
  }
  return response;
};
