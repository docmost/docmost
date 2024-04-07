import api from "@/lib/api-client";
import { IGroup } from "@/features/group/types/group.types";
import { QueryParams } from "@/lib/types.ts";

export async function getGroups(params?: QueryParams): Promise<any> {
  // TODO: returns paginated. Fix type
  const req = await api.post<any>("/groups", params);
  return req.data;
}

export async function getGroupById(groupId: string): Promise<IGroup> {
  const req = await api.post<IGroup>("/groups/info", { groupId });
  return req.data as IGroup;
}

export async function createGroup(data: Partial<IGroup>): Promise<IGroup> {
  const req = await api.post<IGroup>("/groups/create", data);
  return req.data;
}

export async function updateGroup(data: Partial<IGroup>): Promise<IGroup> {
  const req = await api.post<IGroup>("/groups/update", data);
  return req.data;
}

export async function deleteGroup(data: { groupId: string }): Promise<void> {
  await api.post("/groups/delete", data);
}

export async function getGroupMembers(groupId: string) {
  const req = await api.post("/groups/members", { groupId });
  return req.data;
}

export async function addGroupMember(data: {
  groupId: string;
  userIds: string[];
}): Promise<void> {
  await api.post("/groups/members/add", data);
}

export async function removeGroupMember(data: {
  groupId: string;
  userId: string;
}): Promise<void> {
  await api.post("/groups/members/remove", data);
}
