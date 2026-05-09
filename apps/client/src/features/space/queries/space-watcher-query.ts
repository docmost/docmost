import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  watchSpace,
  unwatchSpace,
  getSpaceWatchStatus,
  getWatchedSpaceIds,
} from "@/features/space/services/space-watcher-service";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const SPACE_WATCHER_KEY = "space-watcher";
const WATCHED_SPACE_IDS_KEY = "watched-space-ids";

export function useWatchedSpaceIds(): Set<string> {
  const { data } = useQuery({
    queryKey: [WATCHED_SPACE_IDS_KEY],
    queryFn: () => getWatchedSpaceIds(),
    refetchOnMount: true,
  });

  const items = data?.items;
  return useMemo(() => new Set(items ?? []), [items]);
}

export function useSpaceWatchStatusQuery(spaceId: string) {
  return useQuery({
    queryKey: [SPACE_WATCHER_KEY, spaceId],
    queryFn: () => getSpaceWatchStatus(spaceId),
    enabled: !!spaceId,
    staleTime: 60_000,
  });
}

export function useWatchSpaceMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (spaceId: string) => watchSpace(spaceId),
    onSuccess: (_data, spaceId) => {
      queryClient.setQueryData([SPACE_WATCHER_KEY, spaceId], {
        watching: true,
      });
      queryClient.setQueryData(
        [WATCHED_SPACE_IDS_KEY],
        (old: { items: string[]; meta: any } | undefined) => {
          if (!old) return old;
          if (old.items.includes(spaceId)) return old;
          return { ...old, items: [...old.items, spaceId] };
        },
      );
      notifications.show({ message: t("You are now watching this space") });
    },
  });
}

export function useUnwatchSpaceMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (spaceId: string) => unwatchSpace(spaceId),
    onSuccess: (_data, spaceId) => {
      queryClient.setQueryData([SPACE_WATCHER_KEY, spaceId], {
        watching: false,
      });
      queryClient.setQueryData(
        [WATCHED_SPACE_IDS_KEY],
        (old: { items: string[]; meta: any } | undefined) => {
          if (!old) return old;
          return { ...old, items: old.items.filter((id) => id !== spaceId) };
        },
      );
      notifications.show({
        message: t("You are no longer watching this space"),
      });
    },
  });
}
