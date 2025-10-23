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
import { useLicense } from "@/ee/hooks/use-license";
import { isCloud } from "@/lib/config";

export type UnifiedSearchResult = IPageSearch | IAttachmentSearch;

export interface UseUnifiedSearchParams extends IPageSearchParams {
  contentType?: string;
}

export function useUnifiedSearch(
  params: UseUnifiedSearchParams,
  enabled: boolean = true,
): UseQueryResult<UnifiedSearchResult[], Error> {
  const { hasLicenseKey } = useLicense();

  const isAttachmentSearch =
    params.contentType === "attachment" && (isCloud() || hasLicenseKey);
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
    enabled: !!params.query && enabled,
  });
}
