import api from "@/lib/api-client";
import { IUser } from "@/features/user/types/user.types";
import {
  ICreateInvite,
  IInvitation,
  IWorkspace,
  IAcceptInvite,
} from "../types/workspace.types";
import { IPagination, QueryParams } from "@/lib/types.ts";
import { ITokenResponse } from "@/features/auth/types/auth.types.ts";

export async function getWorkspace(): Promise<IWorkspace> {
  const req = await api.post<IWorkspace>("/workspace/info");
  return req.data;
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
  return req.data;
}

export async function changeMemberRole(data: {
  userId: string;
  role: string;
}): Promise<void> {
  await api.post("/workspace/members/role", data);
}

export async function getPendingInvitations(
  params?: QueryParams,
): Promise<IPagination<IInvitation>> {
  const req = await api.post("/workspace/invites", params);
  return req.data;
}

export async function createInvitation(data: ICreateInvite) {
  const req = await api.post("/workspace/invites/create", data);
  return req.data;
}

export async function acceptInvitation(
  data: IAcceptInvite,
): Promise<ITokenResponse> {
  const req = await api.post("/workspace/invites/accept", data);
  return req.data;
}

export async function resendInvitation(data: {
  invitationId: string;
}): Promise<void> {
  console.log(data);
  await api.post("/workspace/invites/resend", data);
}

export async function revokeInvitation(data: {
  invitationId: string;
}): Promise<void> {
  await api.post("/workspace/invites/revoke", data);
}

export async function getInvitationById(data: {
  invitationId: string;
}): Promise<IInvitation> {
  const req = await api.post("/workspace/invites/info", data);
  return req.data;
}
