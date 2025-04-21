import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";
import api from "@/lib/api-client.ts";

export async function getJoinedWorkspaces(): Promise<Partial<IWorkspace[]>> {
  const req = await api.post<Partial<IWorkspace[]>>("/workspace/joined");
  return req.data;
}
