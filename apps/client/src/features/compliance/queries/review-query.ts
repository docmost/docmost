import {
  InfiniteData,
  useInfiniteQuery,
  UseInfiniteQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  getReviewHistory,
  getReviewInfo,
  getReviewStatuses,
  markReviewed,
  setReview,
} from "@/features/compliance/services/review-service.ts";
import {
  IComplianceScope,
  IReviewInfo,
  IReviewRecord,
  IReviewSetting,
  ReviewStatus,
} from "@/features/compliance/types/compliance.types.ts";
import { IPagination } from "@/lib/types.ts";

export function useReviewInfoQuery(
  scope: IComplianceScope,
): UseQueryResult<IReviewInfo, Error> {
  return useQuery({
    queryKey: ["review-info", scope],
    queryFn: () => getReviewInfo(scope),
    enabled: !!(scope.pageId || scope.spaceId),
  });
}

export function useSetReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    IReviewSetting,
    Error,
    IComplianceScope & { intervalDays: number }
  >({
    mutationFn: (data) => setReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-info"] });
      queryClient.invalidateQueries({ queryKey: ["review-statuses"] });
    },
  });
}

export function useMarkReviewedMutation() {
  const queryClient = useQueryClient();

  return useMutation<IReviewInfo, Error, IComplianceScope & { note?: string }>({
    mutationFn: (data) => markReviewed(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-info"] });
      queryClient.invalidateQueries({ queryKey: ["review-history"] });
      queryClient.invalidateQueries({ queryKey: ["review-statuses"] });
    },
  });
}

export function useReviewStatusesQuery(
  spaceId: string,
): UseQueryResult<Record<string, ReviewStatus>, Error> {
  return useQuery({
    queryKey: ["review-statuses", spaceId],
    queryFn: () => getReviewStatuses(spaceId),
    enabled: !!spaceId,
    staleTime: 60 * 1000,
  });
}

export function useReviewHistoryQuery(
  scope: IComplianceScope,
): UseInfiniteQueryResult<InfiniteData<IPagination<IReviewRecord>, unknown>> {
  return useInfiniteQuery({
    queryKey: ["review-history", scope],
    queryFn: ({ pageParam }) => getReviewHistory(scope, pageParam),
    enabled: !!(scope.pageId || scope.spaceId),
    gcTime: 0,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  });
}
