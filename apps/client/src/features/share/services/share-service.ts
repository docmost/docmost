import api from "@/lib/api-client";
import {
  IExportPageParams,
  IMovePage,
  IMovePageToSpace,
  IPage,
  IPageInput,
  SidebarPagesParams,
} from "@/features/page/types/page.types";
import { IAttachment, IPagination } from "@/lib/types.ts";
import { saveAs } from "file-saver";
import {
  ICreateShare,
  IShareInput,
} from "@/features/share/types/share.types.ts";

export async function createShare(data: ICreateShare): Promise<any> {
  const req = await api.post<any>("/shares/create", data);
  return req.data;
}

export async function getShare(
  shareInput: Partial<IShareInput>,
): Promise<IPage> {
  const req = await api.post<IPage>("/shares/info", shareInput);
  return req.data;
}

export async function updateShare(data: Partial<IShareInput>): Promise<any> {
  const req = await api.post<IPage>("/shares/update", data);
  return req.data;
}

export async function deleteShare(shareId: string): Promise<void> {
  await api.post("/shares/delete", { shareId });
}
