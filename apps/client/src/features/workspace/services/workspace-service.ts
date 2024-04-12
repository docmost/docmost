import api from "@/lib/api-client";
import { IUser } from "@/features/user/types/user.types";
import { IWorkspace } from "../types/workspace.types";
import { IPagination, QueryParams } from "@/lib/types.ts";

export async function getWorkspace(): Promise<IWorkspace> {
  const req = await api.post<IWorkspace>("/workspace/info");
  return req.data as IWorkspace;
}

// Todo: fix all paginated types
export async function getWorkspaceMembers(
  params?: QueryParams,
): Promise<IPagination<IUser>> {
  const req = await api.post("/workspace/members", params);
  return req.data;
}

export async function updateWorkspace(data: Partial<IWorkspace>) {
  const req = await api.post<IWorkspace>("/workspace/update", data);

  return req.data as IWorkspace;
}

export async function changeMemberRole(data: {
  userId: string;
  role: string;
}): Promise<void> {
  await api.post("/workspace/members/role", data);
}
