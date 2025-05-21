import api from "@/lib/api-client";
import { IPage } from "@/features/page/types/page.types";

import {
  ICreateShare,
  IShare,
  ISharedItem,
  ISharedPage,
  ISharedPageTree,
  IShareForPage,
  IShareInfoInput,
  IUpdateShare,
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

export async function getShareInfo(shareId: string): Promise<IShare> {
  const req = await api.post<IShare>("/shares/info", { shareId });
  return req.data;
}

export async function updateShare(data: IUpdateShare): Promise<any> {
  const req = await api.post<any>("/shares/update", data);
  return req.data;
}

export async function getShareForPage(pageId: string): Promise<IShareForPage> {
  const req = await api.post<any>("/shares/for-page", { pageId });
  return req.data;
}

export async function getSharePageInfo(
  shareInput: Partial<IShareInfoInput>,
): Promise<ISharedPage> {
  const req = await api.post<ISharedPage>("/shares/page-info", shareInput);
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
