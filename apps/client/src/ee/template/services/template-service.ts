import api from "@/lib/api-client";
import { ITemplate } from "@/ee/template/types/template.types";
import { IPagination } from "@/lib/types.ts";

export async function getTemplates(params?: {
  spaceId?: string;
  cursor?: string;
  limit?: number;
}): Promise<IPagination<ITemplate>> {
  const req = await api.post("/templates", params);
  return req.data;
}

export async function getTemplateById(
  templateId: string,
): Promise<ITemplate> {
  const req = await api.post<ITemplate>("/templates/info", { templateId });
  return req.data;
}

export async function createTemplate(
  data: Partial<ITemplate>,
): Promise<ITemplate> {
  const req = await api.post<ITemplate>("/templates/create", data);
  return req.data;
}

export async function updateTemplate(
  data: Partial<ITemplate> & { templateId: string },
): Promise<ITemplate> {
  const req = await api.post<ITemplate>("/templates/update", data);
  return req.data;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await api.post<void>("/templates/delete", { templateId });
}

export async function useTemplate(data: {
  templateId: string;
  spaceId: string;
  parentPageId?: string;
}): Promise<any> {
  const req = await api.post("/templates/use", data);
  return req.data;
}
