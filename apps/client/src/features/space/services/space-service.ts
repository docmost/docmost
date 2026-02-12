import api from "@/lib/api-client";
import {
  IAddSpaceMember,
  IChangeSpaceMemberRole,
  IExportSpaceParams,
  IRemoveSpaceMember,
  ISpace,
  ISpaceMember,
} from "@/features/space/types/space.types";
import { IPagination, QueryParams } from "@/lib/types.ts";
import { saveAs } from "file-saver";

export async function getSpaces(
  params?: QueryParams,
): Promise<IPagination<ISpace>> {
  const req = await api.post("/spaces", params);
  return req.data;
}

export async function getSpaceById(spaceId: string): Promise<ISpace> {
  const req = await api.post<ISpace>("/spaces/info", { spaceId });
  return req.data;
}

export async function createSpace(data: Partial<ISpace>): Promise<ISpace> {
  const req = await api.post<ISpace>("/spaces/create", data);
  return req.data;
}

export async function updateSpace(data: Partial<ISpace>): Promise<ISpace> {
  const req = await api.post<ISpace>("/spaces/update", data);
  return req.data;
}

export async function deleteSpace(spaceId: string): Promise<void> {
  await api.post<void>("/spaces/delete", { spaceId });
}

export async function getSpaceMembers(
  spaceId: string,
  params?: QueryParams,
): Promise<IPagination<ISpaceMember>> {
  const req = await api.post<any>("/spaces/members", { spaceId, ...params });
  return req.data;
}

export async function addSpaceMember(data: IAddSpaceMember): Promise<void> {
  await api.post("/spaces/members/add", data);
}

export async function removeSpaceMember(
  data: IRemoveSpaceMember,
): Promise<void> {
  await api.post("/spaces/members/remove", data);
}

export async function changeMemberRole(
  data: IChangeSpaceMemberRole,
): Promise<void> {
  await api.post("/spaces/members/change-role", data);
}

export async function exportSpace(data: IExportSpaceParams): Promise<void> {
  const req = await api.post("/spaces/export", data, {
    responseType: "blob",
  });

  const fileName = req?.headers["content-disposition"]
    .split("filename=")[1]
    .replace(/"/g, "");

  let decodedFileName = fileName;
  try {
    decodedFileName = decodeURIComponent(fileName);
  } catch (err) {
    // fallback to raw filename
  }

  saveAs(req.data, decodedFileName);
}
