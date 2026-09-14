import {
  InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
  UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { getPageAttachments } from "@/features/attachments/services/attachment-service.ts";
import { IPageAttachment } from "@/features/attachments/types/attachment.types.ts";
import { IPagination } from "@/lib/types.ts";

export function usePageAttachmentsQuery(
  pageId: string,
  search?: string,
): UseInfiniteQueryResult<InfiniteData<IPagination<IPageAttachment>, unknown>> {
  return useInfiniteQuery({
    queryKey: ["page-attachments", pageId, search],
    queryFn: ({ pageParam }) =>
      getPageAttachments(pageId, { cursor: pageParam, query: search }),
    enabled: !!pageId,
    gcTime: 0,
    placeholderData: keepPreviousData,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  });
}
