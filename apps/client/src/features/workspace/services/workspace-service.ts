import api from "@/lib/api-client";
import { IUser } from "@/features/user/types/user.types";
import { IWorkspace } from "../types/workspace.types";
import { QueryParams } from "@/lib/types.ts";

export async function getWorkspace(): Promise<IWorkspace> {
  const req = await api.post<IWorkspace>("/workspace/info");
  return req.data as IWorkspace;
}

// Todo: fix all paginated types
export async function getWorkspaceMembers(params?: QueryParams): Promise<any> {
  const req = await api.post<any>("/workspace/members", params);
  return req.data;
}

export async function updateWorkspace(data: Partial<IWorkspace>) {
  const req = await api.post<IWorkspace>("/workspace/update", data);

  return req.data as IWorkspace;
}
