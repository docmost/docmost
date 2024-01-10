import api from '@/lib/api-client';
import { IPageHistory } from '@/features/page-history/types/page.types';

export async function getPageHistoryList(pageId: string): Promise<IPageHistory[]> {
  const req = await api.post<IPageHistory[]>('/pages/history', { pageId });
  return req.data as IPageHistory[];
}

export async function getPageHistoryById(id: string): Promise<IPageHistory> {
  const req = await api.post<IPageHistory>('/pages/history/details', { id });
  return req.data as IPageHistory;
}
