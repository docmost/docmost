import { useInfiniteQuery } from "@tanstack/react-query";
import { listUnsplashPhotos } from "@/features/page-cover/services/page-cover-service.ts";

export function useUnsplashPhotosQuery(query: string) {
  return useInfiniteQuery({
    queryKey: ["unsplash-photos", query],
    queryFn: ({ pageParam }) => listUnsplashPhotos({ query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    staleTime: 10 * 60 * 1000,
    // a failed search would only spend more of the Unsplash hourly limit
    retry: false,
  });
}
