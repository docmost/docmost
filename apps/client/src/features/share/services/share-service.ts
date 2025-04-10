import api from "@/lib/api-client";
import { IPage } from "@/features/page/types/page.types";

import {
  ICreateShare,
  IShareInfoInput,
} from "@/features/share/types/share.types.ts";

export async function createShare(data: ICreateShare): Promise<any> {
  const req = await api.post<any>("/shares/create", data);
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
  const req = await api.post<IPage>("/shares/update", data);
  return req.data;
}

export async function deleteShare(shareId: string): Promise<void> {
  await api.post("/shares/delete", { shareId });
}
