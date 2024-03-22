import api from '@/lib/api-client';
import { ISpace } from '@/features/space/types/space.types';

export async function getUserSpaces(): Promise<ISpace[]> {
  const req = await api.get<ISpace[]>('/spaces');
  return req.data as ISpace[];
}
