import api from "@/lib/api-client";
import { IPageSearchParams } from '@/features/search/types/search.types';

export interface IAiSearchResponse {
  answer: string;
  sources?: Array<{
    pageId: string;
    title: string;
    slugId: string;
    spaceSlug: string;
    similarity: number;
    distance: number;
    chunkIndex: number;
    excerpt: string;
  }>;
}

export async function askAi(
  params: IPageSearchParams,
): Promise<IAiSearchResponse> {
  const req = await api.post<IAiSearchResponse>("/ai/ask", params);
  return req.data;
}