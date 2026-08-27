import api from "@/lib/api-client";
import {
  IGoogleSsoConfig,
  IGroupMapping,
  IMappingPreview,
  IWizardMapping,
} from "@/features/sso/types/sso.types.ts";

export async function getSsoConfig(): Promise<IGoogleSsoConfig> {
  const req = await api.post<IGoogleSsoConfig>("/sso/config");
  return req.data;
}

export async function updateSsoConfig(
  data: Partial<
    Pick<IGoogleSsoConfig, "isEnabled" | "allowSignup" | "groupSync">
  >,
): Promise<void> {
  await api.post("/sso/config/update", data);
}

export async function getGroupMappings(): Promise<IGroupMapping[]> {
  const req = await api.post<IGroupMapping[]>("/sso/config/mappings");
  return req.data;
}

export async function createGroupMapping(data: {
  externalGroupKey: string;
  groupId: string;
  role?: string;
}): Promise<IGroupMapping> {
  const req = await api.post<IGroupMapping>(
    "/sso/config/mappings/create",
    data,
  );
  return req.data;
}

export async function deleteGroupMapping(data: {
  mappingId: string;
}): Promise<void> {
  await api.post("/sso/config/mappings/delete", data);
}

export async function previewMapping(data: {
  externalGroupKey: string;
  groupId: string;
}): Promise<IMappingPreview> {
  const req = await api.post<IMappingPreview>("/sso/config/preview", data);
  return req.data;
}

export async function commitWizard(data: {
  mappings: IWizardMapping[];
  runSync?: boolean;
}): Promise<{ created: number; syncQueued: boolean }> {
  const req = await api.post("/sso/config/wizard/commit", data);
  return req.data;
}

export async function resyncGroups(data: {
  mappingId?: string;
}): Promise<void> {
  await api.post("/sso/config/resync", data);
}
