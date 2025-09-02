import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { askAi, IAiSearchResponse } from "@/features/search/services/ai-search-service";
import { IPageSearchParams } from "@/features/search/types/search.types";
import { useLicense } from "@/ee/hooks/use-license";

export function useAiSearch(
  params: IPageSearchParams,
  enabled: boolean = false,
): UseQueryResult<IAiSearchResponse, Error> {
  const { hasLicenseKey } = useLicense();

  return useQuery({
    queryKey: ["ai-search", params],
    queryFn: async () => {
      return await askAi(params);
    },
    enabled: !!params.query && hasLicenseKey && enabled,
    staleTime: Infinity, // Don't refetch automatically
    gcTime: 0, // Don't cache results when component unmounts
  });
}