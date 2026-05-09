import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getBacklinks,
  getBacklinksCount,
} from "@/features/page-details/services/backlinks-service.ts";
import {
  BacklinkDirection,
  IBacklinkCount,
} from "@/features/page-details/types/backlink.types.ts";

const BACKLINKS_STALE_TIME = 30 * 1000;
const BACKLINKS_PAGE_LIMIT = 100;

export function useBacklinksCountQuery(pageId: string | undefined) {
  return useQuery<IBacklinkCount>({
    queryKey: ["backlinks-count", pageId],
    queryFn: () => getBacklinksCount(pageId as string),
    enabled: !!pageId,
    staleTime: BACKLINKS_STALE_TIME,
  });
}

export function useBacklinksQuery(
  pageId: string | undefined,
  direction: BacklinkDirection,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: ["backlinks", pageId, direction],
    queryFn: ({ pageParam }) =>
      getBacklinks({
        pageId: pageId as string,
        direction,
        cursor: pageParam,
        limit: BACKLINKS_PAGE_LIMIT,
      }),
    enabled: enabled && !!pageId,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage
        ? (lastPage.meta.nextCursor ?? undefined)
        : undefined,
    staleTime: BACKLINKS_STALE_TIME,
  });
}
