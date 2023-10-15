import api from '@/lib/api-client';
import { IMovePage, IPage, IWorkspacePageOrder } from '@/features/page/types/page.types';

export async function createPage(data: Partial<IPage>): Promise<IPage> {
  const req = await api.post<IPage>('/page/create', data);
  return req.data as IPage;
}

export async function getPageById(id: string): Promise<IPage> {
  const req = await api.post<IPage>('/page/details', { id });
  return req.data as IPage;
}

export async function getPages(): Promise<IPage[]> {
  const req = await api.post<IPage[]>('/page/list');
  return req.data as IPage[];
}

export async function getWorkspacePageOrder(): Promise<IWorkspacePageOrder[]> {
  const req = await api.post<IWorkspacePageOrder[]>('/page/list/order');
  return req.data as IWorkspacePageOrder[];
}

export async function updatePage(data: Partial<IPage>): Promise<IPage> {
  const req = await api.post<IPage>(`/page/update`, data);
  return req.data as IPage;
}

export async function movePage(data: IMovePage): Promise<void> {
  await api.post<IMovePage>('/page/move', data);
}

export async function deletePage(id: string): Promise<void> {
  await api.post('/page/delete', { id });
}
