import { apiClient } from "config/Axios";
import { DataResponse } from "types/Response";
import User, { UserForm } from "types/User";
import responseFormatter from "utils/responseFormatter";

export const sendCreateUser = async (user: UserForm) => {
  return (await responseFormatter(apiClient.post('/user', user))).data
}

export const getAllUsers = async (): Promise<DataResponse<User[]>> => {
  return await responseFormatter(apiClient.get('/user/get-all'));
}

export const deleteUser = async (username: string) => {
  return await responseFormatter(apiClient.delete('/user', { data: { username } }));
};

export const updateUserAccess = async (
  userId: string,
  access: { dashboard: string; sections: string[] }[]
) => {
  return await responseFormatter(
    apiClient.post(`/user/access/${userId}`, { access })
  );
};

// export const addDashboardAccessToUser = async (
//   userId: string,
//   dashboardId: string,
//   sections?: string[]
// ) => {
//   return await responseFormatter(
//     apiClient.post(`/user/${userId}/dashboard/${dashboardId}`, { sections })
//   );
// };

// export const removeDashboardAccessFromUser = async (
//   userId: string,
//   dashboardId: string
// ) => {
//   return await responseFormatter(
//     apiClient.delete(`/user/${userId}/dashboard/${dashboardId}`)
//   );
// };
