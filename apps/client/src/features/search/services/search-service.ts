import api from '@/lib/api-client';
import { IPageSearch } from '@/features/search/types/search.types';

export async function searchPage(query: string): Promise<IPageSearch[]> {
  const req = await api.post<IPageSearch[]>('/search', {  query });
  return req.data as any;
}
