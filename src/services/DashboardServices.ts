import { apiClient } from "config/Axios";
import Dashboard from "types/Dashboard";
import { DataResponse } from "types/Response";
import responseFormatter from "utils/responseFormatter";

export const sendCreateDashboard = async (dashboard: any) => {
  return (await responseFormatter(apiClient.post('/dashboard', dashboard))).data;
};

export const getAllDashboards = async (): Promise<DataResponse<Dashboard[]>> => {
  return await responseFormatter(apiClient.get('/dashboard/get-all'));
};

export const deleteDashboard = async (id: string) => (await apiClient.delete(`/dashboard/${id}`)).data.data;
export const reconcileGeneratedDashboards = async () => (await apiClient.post('/dashboard/reconcile-generated')).data.data;

export const sendEditDashboard = async (dashboardId: string, show?: boolean, icon?: string, newName?: string, newKeyname?: string) => {
  const payload: any = {};
  if (show !== undefined) payload.show = show;
  if (icon !== undefined) payload.icon = icon;
  if (newName !== undefined) payload.newName = newName;
  if (newKeyname !== undefined) payload.newKeyname = newKeyname;

  return (await responseFormatter(apiClient.put(`/dashboard/edit/${dashboardId}`, payload))).data;
};

export const sendAddSection = async (dashboardId: string, sections: string[]) => {
  return (await responseFormatter(
    apiClient.post(`/dashboard/add/${dashboardId}`, { sections })
  )).data;
};

// export const getAllSections

// export const addSection
