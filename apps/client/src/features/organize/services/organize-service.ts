import api from "@/lib/api-client";
import {
  IOrganizeTask,
  IOrganizeTaskDetail,
} from "@/features/organize/types/organize.types";

export async function createOrganizeTask(data: {
  spaceId?: string;
  source?: "upload" | "code" | "manual";
  title?: string;
  total?: number;
  fileTaskId?: string;
}): Promise<IOrganizeTask> {
  const req = await api.post<IOrganizeTask>("/organize-tasks/create", data);
  return req.data;
}

export async function getOrganizeTask(
  organizeTaskId: string,
): Promise<IOrganizeTaskDetail> {
  const req = await api.post<IOrganizeTaskDetail>("/organize-tasks/info", {
    organizeTaskId,
  });
  return req.data;
}

export async function getOrganizeTaskByToken(
  shareToken: string,
): Promise<IOrganizeTaskDetail> {
  const req = await api.post<IOrganizeTaskDetail>("/organize-tasks/by-token", {
    shareToken,
  });
  return req.data;
}

export interface IFileTask {
  id: string;
  status: string;
  errorMessage?: string | null;
}

export async function bulkImportFiles(
  spaceId: string,
  files: File[],
): Promise<IFileTask> {
  const formData = new FormData();
  formData.append("spaceId", spaceId);
  files.forEach((file) => {
    // honor relative paths (folder upload) so the importer builds a tree
    const name = (file as any).webkitRelativePath || file.name;
    formData.append("files", file, name);
  });
  const req = await api.post<IFileTask>("/pages/import-files", formData);
  return req.data;
}
