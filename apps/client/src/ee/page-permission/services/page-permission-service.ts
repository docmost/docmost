import api from "@/lib/api-client";
import { IPagination, QueryParams } from "@/lib/types";
import {
  IAddPagePermission,
  IPagePermissionMember,
  IPageRestrictionInfo,
  IRemovePagePermission,
  IUpdatePagePermissionRole,
} from "@/ee/page-permission/types/page-permission.types";

export async function restrictPage(pageId: string): Promise<void> {
  await api.post("/pages/permissions/restrict", { pageId });
}

export async function addPagePermission(
  data: IAddPagePermission,
): Promise<void> {
  await api.post("/pages/permissions/add-members", data);
}

export async function removePagePermission(
  data: IRemovePagePermission,
): Promise<void> {
  await api.post("/pages/permissions/remove-members", data);
}

export async function updatePagePermissionRole(
  data: IUpdatePagePermissionRole,
): Promise<void> {
  await api.post("/pages/permissions/change-role", data);
}

export async function unrestrictPage(pageId: string): Promise<void> {
  await api.post("/pages/permissions/unrestrict", { pageId });
}

export async function getPagePermissions(
  pageId: string,
  params?: QueryParams,
): Promise<IPagination<IPagePermissionMember>> {
  const req = await api.post<IPagination<IPagePermissionMember>>(
    "/pages/permissions/members",
    { pageId, ...params },
  );
  return req.data;
}

export async function getPageRestrictionInfo(
  pageId: string,
): Promise<IPageRestrictionInfo> {
  const req = await api.post<IPageRestrictionInfo>("/pages/permissions/info", {
    pageId,
  });
  return req.data;
}
