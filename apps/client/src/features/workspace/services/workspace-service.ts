import api from "@/lib/api-client";
import { IUser } from "@/features/user/types/user.types";
import {
  ICreateInvite,
  IInvitation,
  IWorkspace,
  IAcceptInvite,
  IInvitationLink,
} from "../types/workspace.types";
import { IPagination, QueryParams } from "@/lib/types.ts";

export async function getWorkspace(): Promise<IWorkspace> {
  const req = await api.post<IWorkspace>("/workspace/info");
  return req.data;
}

export async function getWorkspacePublicData(): Promise<IWorkspace> {
  const req = await api.post<IWorkspace>("/workspace/public");
  return req.data;
}

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
  await api.post("/workspace/members/change-role", data);
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

export async function acceptInvitation(data: IAcceptInvite): Promise<void> {
  await api.post<void>("/workspace/invites/accept", data);
}

export async function getInviteLink(data: {
  invitationId: string;
}): Promise<IInvitationLink> {
  const req = await api.post("/workspace/invites/link", data);
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

export async function uploadLogo(file: File) {
  const formData = new FormData();
  formData.append("type", "workspace-logo");
  formData.append("image", file);

  const req = await api.post("/attachments/upload-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return req.data;
}
