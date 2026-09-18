import { apiClient } from "config/Axios";
import { DataResponse } from "types/Response";
import Sections from "types/Sections";
import responseFormatter from "utils/responseFormatter";

export const sendCreateSection = async (section: any) => {
  return (await responseFormatter(apiClient.post('/sections/add', section))).data;
};

export const getAllSections = async (): Promise<DataResponse<Sections[]>> => {
  return await responseFormatter(apiClient.get('/sections/get-all'));
};

export const sendEditSection = async (sectionId: string, show?: boolean, newName?: string, newKeyname?: string) => {
  const payload: any = {};
  if (show !== undefined) payload.show = show;
  if (newName !== undefined) payload.newName = newName;
  if (newKeyname !== undefined) payload.newKeyname = newKeyname;

  return (await responseFormatter(apiClient.put(`/sections/edit/${sectionId}`, payload))).data;
};

// SectionsServices.ts
export const sendDeleteSection = async (sectionId: string) => {
  return (await apiClient.delete(`/sections/delete/${sectionId}`)).data.data;
};


// export const getAllSections

// export const addSection