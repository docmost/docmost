import api from "@/lib/api-client";
import { IPage } from "@/features/page/types/page.types";

import {
  ICreateShare,
  ISharedItem,
  ISharedPageTree,
  IShareInfoInput,
} from "@/features/share/types/share.types.ts";
import { IPagination, QueryParams } from "@/lib/types.ts";

export async function getShares(
  params?: QueryParams,
): Promise<IPagination<ISharedItem>> {
  const req = await api.post("/shares", params);
  return req.data;
}

export async function createShare(data: ICreateShare): Promise<any> {
  const req = await api.post<any>("/shares/create", data);
  return req.data;
}

export async function getShareStatus(pageId: string): Promise<any> {
  const req = await api.post<any>("/shares/status", { pageId });
  return req.data;
}

export async function getShareInfo(
  shareInput: Partial<IShareInfoInput>,
): Promise<IPage> {
  const req = await api.post<IPage>("/shares/info", shareInput);
  return req.data;
}

export async function updateShare(
  data: Partial<IShareInfoInput>,
): Promise<any> {
  const req = await api.post<any>("/shares/update", data);
  return req.data;
}

export async function deleteShare(shareId: string): Promise<void> {
  await api.post("/shares/delete", { shareId });
}

export async function getSharedPageTree(
  shareId: string,
): Promise<ISharedPageTree> {
  const req = await api.post<ISharedPageTree>("/shares/tree", { shareId });
  return req.data;
}
