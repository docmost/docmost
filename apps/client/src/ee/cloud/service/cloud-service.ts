import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";
import api from "@/lib/api-client.ts";

export async function getJoinedWorkspaces(): Promise<Partial<IWorkspace[]>> {
  const req = await api.post<Partial<IWorkspace[]>>("/workspace/joined");
  return req.data;
}

export async function findWorkspacesByEmail(email: string): Promise<void> {
  await api.post("/workspace/find-by-email", { email });
}

export async function verifyEmail(data: { token: string }): Promise<void> {
  await api.post("/workspace/verify-email", data);
}

export async function resendVerificationEmail(data: { email: string; sig: string }): Promise<void> {
  await api.post("/workspace/resend-verification", data);
}
