import api from "@/lib/api-client";
import {
  IMovePage,
  IPage,
  IPageInput,
  SidebarPagesParams,
} from "@/features/page/types/page.types";
import { IAttachment, IPagination } from "@/lib/types.ts";

export async function createPage(data: Partial<IPage>): Promise<IPage> {
  const req = await api.post<IPage>("/pages/create", data);
  return req.data;
}

export async function getPageById(
  pageInput: Partial<IPageInput>,
): Promise<IPage> {
  const req = await api.post<IPage>("/pages/info", pageInput);
  return req.data;
}

export async function updatePage(data: Partial<IPageInput>): Promise<IPage> {
  const req = await api.post<IPage>("/pages/update", data);
  return req.data;
}

export async function deletePage(pageId: string): Promise<void> {
  await api.post("/pages/delete", { pageId });
}

export async function movePage(data: IMovePage): Promise<void> {
  await api.post<void>("/pages/move", data);
}

export async function getSidebarPages(
  params: SidebarPagesParams,
): Promise<IPagination<IPage>> {
  const req = await api.post("/pages/sidebar-pages", params);
  return req.data;
}

export async function getPageBreadcrumbs(
  pageId: string,
): Promise<Partial<IPage[]>> {
  const req = await api.post("/pages/breadcrumbs", { pageId });
  return req.data;
}

export async function getRecentChanges(
  spaceId?: string,
): Promise<IPagination<IPage>> {
  const req = await api.post("/pages/recent", { spaceId });
  return req.data;
}

export async function uploadFile(file: File, pageId: string) {
  const formData = new FormData();
  formData.append("pageId", pageId);
  formData.append("file", file);

  // should be file endpoint
  const req = await api.post<IAttachment>("/files/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  // console.log("req", req);

  return req;
}
