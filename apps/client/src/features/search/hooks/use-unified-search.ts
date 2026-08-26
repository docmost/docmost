import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  searchPage,
  searchAttachments,
} from "@/features/search/services/search-service";
import {
  IAttachmentSearch,
  IPageSearch,
  IPageSearchParams,
} from "@/features/search/types/search.types";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";

export type UnifiedSearchResult = IPageSearch | IAttachmentSearch;

export interface UseUnifiedSearchParams extends IPageSearchParams {
  contentType?: string;
}

export function useUnifiedSearch(
  params: UseUnifiedSearchParams,
  enabled: boolean = true,
): UseQueryResult<UnifiedSearchResult[], Error> {
  const hasAttachmentIndexing = useHasFeature(Feature.ATTACHMENT_INDEXING);

  const isAttachmentSearch =
    params.contentType === "attachment" && hasAttachmentIndexing;
  const searchType = isAttachmentSearch ? "attachment" : "page";

  return useQuery({
    queryKey: ["unified-search", searchType, params],
    queryFn: async () => {
      // Remove contentType from backend params since it's only used for frontend routing
      const { contentType, ...backendParams } = params;

      if (isAttachmentSearch) {
        return await searchAttachments(backendParams);
      } else {
        return await searchPage(backendParams);
      }
    },
    enabled:
      (!!params.query ||
        (params.labelIds?.length ?? 0) > 0 ||
        !!params.creatorId) &&
      enabled,
    // keep previous results only within the same search type; page results
    // rendered as attachments (or vice versa) crash on missing fields
    placeholderData: (previousData, previousQuery) => {
      if (!params.query && !params.labelIds?.length && !params.creatorId)
        return undefined;
      if (previousQuery && previousQuery.queryKey[1] !== searchType) {
        return undefined;
      }
      return previousData;
    },
  });
}
