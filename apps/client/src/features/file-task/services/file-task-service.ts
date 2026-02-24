import api from "@/lib/api-client";
import { IFileTask } from "@/features/file-task/types/file-task.types.ts";
import { IPagination, QueryParams } from "@/lib/types.ts";
import { IApiKey } from "@/ee/api-key";

export async function getFileTaskById(fileTaskId: string): Promise<IFileTask> {
  const req = await api.post<IFileTask>("/file-tasks/info", {
    fileTaskId: fileTaskId,
  });
  return req.data;
}

export async function getFileTasks(
  params?: QueryParams,
): Promise<IPagination<IFileTask>> {
  const req = await api.post("/file-tasks", { ...params });
  return req.data;
}

