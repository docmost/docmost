import api from '@/lib/api-client';
import { IMovePage, IPage, IWorkspacePageOrder } from '@/features/page/types/page.types';

export async function createPage(data: Partial<IPage>): Promise<IPage> {
  const req = await api.post<IPage>('/pages/create', data);
  return req.data as IPage;
}

export async function getPageById(id: string): Promise<IPage> {
  const req = await api.post<IPage>('/pages/details', { id });
  return req.data as IPage;
}

export async function getRecentChanges(): Promise<IPage[]> {
  const req = await api.post<IPage[]>('/pages/recent');
  return req.data as IPage[];
}

export async function getPages(): Promise<IPage[]> {
  const req = await api.post<IPage[]>('/pages');
  return req.data as IPage[];
}

export async function getWorkspacePageOrder(): Promise<IWorkspacePageOrder[]> {
  const req = await api.post<IWorkspacePageOrder[]>('/pages/ordering');
  return req.data as IWorkspacePageOrder[];
}

export async function updatePage(data: Partial<IPage>): Promise<IPage> {
  const req = await api.post<IPage>(`/pages/update`, data);
  return req.data as IPage;
}

export async function movePage(data: IMovePage): Promise<void> {
  await api.post<IMovePage>('/pages/move', data);
}

export async function deletePage(id: string): Promise<void> {
  await api.post('/pages/delete', { id });
}
