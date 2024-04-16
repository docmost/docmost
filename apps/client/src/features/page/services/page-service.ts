import api from "@/lib/api-client";
import {
  IMovePage,
  IPage,
  SidebarPagesParams,
} from "@/features/page/types/page.types";
import { IPagination } from "@/lib/types.ts";

export async function createPage(data: Partial<IPage>): Promise<IPage> {
  const req = await api.post<IPage>("/pages/create", data);
  return req.data;
}

export async function getPageById(pageId: string): Promise<IPage> {
  const req = await api.post<IPage>("/pages/info", { pageId });
  return req.data;
}

export async function updatePage(data: Partial<IPage>): Promise<IPage> {
  const req = await api.post<IPage>("/pages/update", data);
  return req.data;
}

export async function deletePage(pageId: string): Promise<void> {
  await api.post("/pages/delete", { pageId });
}

export async function movePage(data: IMovePage): Promise<void> {
  await api.post<void>("/pages/move", data);
}

export async function getRecentChanges(): Promise<IPage[]> {
  const req = await api.post<IPage[]>("/pages/recent");
  return req.data;
}

export async function getSidebarPages(
  params: SidebarPagesParams,
): Promise<IPagination<IPage>> {
  const req = await api.post("/pages/sidebar-pages", params);
  return req.data;
}
