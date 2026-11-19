import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getUserProfile,
  getUserRecentPages,
  getUserSpaces,
} from "@/features/user/services/user-service";

export function useUserProfileQuery(
  userId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => getUserProfile(userId),
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 60_000,
    refetchOnMount: true,
  });
}

export function useUserSpacesQuery(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["user-spaces", userId],
    queryFn: ({ pageParam }) =>
      getUserSpaces({ userId, cursor: pageParam, limit: 10 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    enabled: !!userId,
    refetchOnMount: true,
  });
}

export function useUserRecentPagesQuery(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["user-recent-pages", userId],
    queryFn: ({ pageParam }) =>
      getUserRecentPages({ userId, cursor: pageParam, limit: 10 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    enabled: !!userId,
    refetchOnMount: true,
  });
}

