import api from "@/lib/api-client";
import {
  IExportPageParams,
  IPage,
  IPageInput,
  SidebarPagesParams,
} from "@/features/page/types/page.types";
import { IPagination } from "@/lib/types.ts";
import { saveAs } from "file-saver";

export async function getSharedPageById(
  pageInput: Partial<IPageInput>,
): Promise<IPage> {
  const req = await api.post<IPage>("/share/pages/info", pageInput);
  return req.data;
}

export async function getSharedSidebarPages(
  params: SidebarPagesParams,
): Promise<IPagination<IPage>> {
  const req = await api.post("/share/pages/sidebar-pages", params);
  return req.data;
}

export async function getSharedPageBreadcrumbs(
  pageId: string,
): Promise<Partial<IPage[]>> {
  const req = await api.post("/share/pages/breadcrumbs", { pageId });
  return req.data;
}

export async function getSharedRecentChanges(
  spaceId?: string,
): Promise<IPagination<IPage>> {
  const req = await api.post("/share/pages/recent", { spaceId });
  return req.data;
}

export async function exportSharedPage(data: IExportPageParams): Promise<void> {
  const req = await api.post("/share/pages/export", data, {
    responseType: "blob",
  });

  const fileName = req?.headers["content-disposition"]
    .split("filename=")[1]
    .replace(/"/g, "");

  saveAs(req.data, decodeURIComponent(fileName));
}
