import api from "@/lib/api-client";
import {
  IMovePage,
  IPage,
  IWorkspacePageOrder,
} from "@/features/page/types/page.types";

export async function createPage(data: Partial<IPage>): Promise<IPage> {
  const req = await api.post<IPage>("/pages/create", data);
  return req.data as IPage;
}

export async function getPageById(pageId: string): Promise<IPage> {
  const req = await api.post<IPage>("/pages/info", { pageId });
  return req.data as IPage;
}

export async function getRecentChanges(): Promise<IPage[]> {
  const req = await api.post<IPage[]>("/pages/recent");
  return req.data as IPage[];
}

export async function getPages(spaceId: string): Promise<IPage[]> {
  const req = await api.post<IPage[]>("/pages", { spaceId });
  return req.data as IPage[];
}

export async function getSpacePageOrder(
  spaceId: string,
): Promise<IWorkspacePageOrder[]> {
  const req = await api.post<IWorkspacePageOrder[]>("/pages/ordering", {
    spaceId,
  });
  return req.data as IWorkspacePageOrder[];
}

export async function updatePage(data: Partial<IPage>): Promise<IPage> {
  const req = await api.post<IPage>(`/pages/update`, data);
  return req.data as IPage;
}

export async function movePage(data: IMovePage): Promise<void> {
  await api.post<IMovePage>("/pages/move", data);
}

export async function deletePage(id: string): Promise<void> {
  await api.post("/pages/delete", { id });
}
