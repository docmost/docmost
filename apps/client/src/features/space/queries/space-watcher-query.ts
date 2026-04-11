import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  watchSpace,
  unwatchSpace,
  getSpaceWatchStatus,
} from "@/features/space/services/space-watcher-service";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const SPACE_WATCHER_KEY = "space-watcher";

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
      notifications.show({
        message: t("You are no longer watching this space"),
      });
    },
  });
}
