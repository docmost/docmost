import api from "@/lib/api-client";
import { ITemplate, type TemplateVariableValues } from "@/ee/template/types/template.types";
import { IPage } from "@/features/page/types/page.types";
import { IPagination } from "@/lib/types.ts";

export async function getTemplates(params?: {
  spaceId?: string;
  currentSpaceId?: string;
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

type TemplateApplication = {
  template: Pick<ITemplate, "id" | "updatedAt">;
  variableValues?: TemplateVariableValues;
};

export async function applyTemplate({ template, ...data }: TemplateApplication & {
  pageId: string;
}): Promise<ITemplate> {
  const req = await api.post<ITemplate>("/templates/apply", {
    ...data,
    templateId: template.id,
    templateUpdatedAt: template.updatedAt,
  });
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

export async function useTemplate({ template, ...data }: TemplateApplication & {
  spaceId: string;
  parentPageId?: string;
}): Promise<IPage> {
  const req = await api.post<IPage>("/templates/use", {
    ...data,
    templateId: template.id,
    templateUpdatedAt: template.updatedAt,
  });
  return req.data;
}
