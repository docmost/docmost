import api from "@/lib/api-client";
import { IFileTask } from "@/features/file-task/types/file-task.types.ts";

export async function getFileTaskById(fileTaskId: string): Promise<IFileTask> {
  const req = await api.post<IFileTask>("/file-tasks/info", {
    fileTaskId: fileTaskId,
  });
  return req.data;
}

export async function getFileTasks(): Promise<IFileTask[]> {
  const req = await api.post<IFileTask[]>("/file-tasks");
  return req.data;
}
