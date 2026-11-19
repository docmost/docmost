import api from "@/lib/api-client";
import { ITemplate } from "@/ee/template/types/template.types";
import { IPage } from "@/features/page/types/page.types";
import { IPagination } from "@/lib/types.ts";
import {
  EDITOR_SCHEMA_HEADER,
  EDITOR_SCHEMA_VERSION,
} from "@docmost/editor-ext";

const editorRequest = {
  headers: { [EDITOR_SCHEMA_HEADER]: String(EDITOR_SCHEMA_VERSION) },
};

export async function getTemplates(params?: {
  spaceId?: string;
  currentSpaceId?: string;
  cursor?: string;
  limit?: number;
}): Promise<IPagination<ITemplate>> {
  const req = await api.post("/templates", params);
  return req.data;
}

export async function getTemplateById(templateId: string): Promise<ITemplate> {
  const req = await api.post<ITemplate>(
    "/templates/info",
    { templateId },
    editorRequest,
  );
  return req.data;
}

export async function applyTemplate(data: {
  templateId: string;
  pageId: string;
}): Promise<ITemplate> {
  const req = await api.post<ITemplate>(
    "/templates/apply",
    data,
    editorRequest,
  );
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
  const req = await api.post<ITemplate>(
    "/templates/update",
    data,
    editorRequest,
  );
  return req.data;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await api.post<void>("/templates/delete", { templateId });
}

export async function useTemplate(data: {
  templateId: string;
  spaceId: string;
  parentPageId?: string;
}): Promise<IPage> {
  const req = await api.post<IPage>("/templates/use", data, editorRequest);
  return req.data;
}
