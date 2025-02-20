import { validate as isValidUuid } from "uuid";
import { useEffect } from "react";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { queryClient } from "@/main.tsx";
import { ISpace } from "@/features/space/types/space.types";
import { getSharedSpaceById } from "@/features/space/services/shared-space-service";
import { getSharedRecentChanges } from "@/features/page/services/shared-page-service";

export function useSharedSpaceQuery(spaceId: string): UseQueryResult<ISpace, Error> {
  const query = useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => getSharedSpaceById(spaceId),
    enabled: !!spaceId,
  });
  useEffect(() => {
    if (query.data) {
      if (isValidUuid(spaceId)) {
        queryClient.setQueryData(["space", query.data.slug], query.data);
      } else {
        queryClient.setQueryData(["space", query.data.id], query.data);
      }
    }
  }, [query.data]);

  return query;
}

export const prefetchSharedSpace = (spaceSlug: string, spaceId?: string) => {
  queryClient.prefetchQuery({
    queryKey: ["space", spaceSlug],
    queryFn: () => getSharedSpaceById(spaceSlug),
  });

  if (spaceId) {
    // this endpoint only accepts uuid for now
    queryClient.prefetchQuery({
      queryKey: ["recent-changes", spaceId],
      queryFn: () => getSharedRecentChanges(spaceId),
    });
  }
};

export function useGetSharedSpaceBySlugQuery(
  spaceId: string,
): UseQueryResult<ISpace, Error> {
  return useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => getSharedSpaceById(spaceId),
    enabled: !!spaceId,
    staleTime: 5 * 60 * 1000,
  });
}
