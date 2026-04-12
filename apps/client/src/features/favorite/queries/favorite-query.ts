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
  ToggleFavoriteParams,
} from "../services/favorite-service";
import { IPagination } from "@/lib/types.ts";
import { IFavorite, FavoriteType } from "../types/favorite.types";

export function useFavoritesQuery(type?: FavoriteType) {
  return useInfiniteQuery({
    queryKey: ["favorites", type],
    queryFn: ({ pageParam }) =>
      getFavorites({ type, cursor: pageParam, limit: 15 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    refetchOnMount: true,
  });
}

export function useFavoriteIds(type: FavoriteType): Set<string> {
  const { data } = useQuery<IPagination<IFavorite>>({
    queryKey: ["favorite-ids", type],
    queryFn: () => getFavorites({ type, limit: 50 }),
    refetchOnMount: true,
  });

  const ids = new Set<string>();
  if (data?.items) {
    for (const fav of data.items) {
      let id: string | undefined;
      if (type === "page") id = fav.pageId;
      else if (type === "space") id = fav.spaceId;
      else if (type === "template") id = fav.templateId;
      if (id) ids.add(id);
    }
  }
  return ids;
}

export function useAddFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ToggleFavoriteParams>({
    mutationFn: (data) => addFavorite(data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["favorite-ids", variables.type],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["favorite-ids", variables.type],
      });
      queryClient.invalidateQueries({
        queryKey: ["favorites", variables.type],
      });
    },
  });
}
