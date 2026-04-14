import { useMemo } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  addFavorite,
  removeFavorite,
  getFavorites,
  getFavoriteIds,
  ToggleFavoriteParams,
} from "../services/favorite-service";
import { FavoriteType } from "../types/favorite.types";

export function useFavoritesQuery(type?: FavoriteType, spaceId?: string) {
  return useInfiniteQuery({
    queryKey: ["favorites", type, spaceId],
    queryFn: ({ pageParam }) =>
      getFavorites({ type, spaceId, cursor: pageParam, limit: 15 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    refetchOnMount: true,
  });
}

export function useFavoriteIds(type: FavoriteType, spaceId?: string): Set<string> {
  const { data } = useQuery({
    queryKey: ["favorite-ids", type, spaceId],
    queryFn: () => getFavoriteIds(type, spaceId),
    refetchOnMount: true,
  });

  const items = data?.items;
  return useMemo(() => new Set(items ?? []), [items]);
}

function getEntityId(variables: ToggleFavoriteParams): string | undefined {
  if (variables.type === "page") return variables.pageId;
  if (variables.type === "space") return variables.spaceId;
  if (variables.type === "template") return variables.templateId;
  return undefined;
}

export function useAddFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ToggleFavoriteParams>({
    mutationFn: (data) => addFavorite(data),
    onSuccess: (_result, variables) => {
      const entityId = getEntityId(variables);
      if (entityId) {
        queryClient.setQueriesData<{ items: string[]; meta: any }>(
          { queryKey: ["favorite-ids", variables.type] },
          (old) => {
            if (!old) return old;
            if (old.items.includes(entityId)) return old;
            return { ...old, items: [...old.items, entityId] };
          },
        );
      }
      queryClient.invalidateQueries({
        queryKey: ["favorites", variables.type],
      });
    },
  });
}

export function useRemoveFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ToggleFavoriteParams>({
    mutationFn: (data) => removeFavorite(data),
    onSuccess: (_result, variables) => {
      const entityId = getEntityId(variables);
      if (entityId) {
        queryClient.setQueriesData<{ items: string[]; meta: any }>(
          { queryKey: ["favorite-ids", variables.type] },
          (old) => {
            if (!old) return old;
            return { ...old, items: old.items.filter((id) => id !== entityId) };
          },
        );
      }
      queryClient.invalidateQueries({
        queryKey: ["favorites", variables.type],
      });
    },
  });
}
