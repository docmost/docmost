import api from "@/lib/api-client";
import { IPagination } from "@/lib/types.ts";
import {
  IBacklinkCount,
  IBacklinkPageItem,
  IBacklinksListParams,
} from "@/features/page-details/types/backlink.types.ts";

export async function getBacklinksCount(
  pageId: string,
): Promise<IBacklinkCount> {
  const req = await api.post<IBacklinkCount>("/pages/backlinks-count", {
    pageId,
  });
  return req.data;
}

export async function getBacklinks(
  params: IBacklinksListParams,
): Promise<IPagination<IBacklinkPageItem>> {
  const req = await api.post<IPagination<IBacklinkPageItem>>(
    "/pages/backlinks",
    params,
  );
  return req.data;
}
