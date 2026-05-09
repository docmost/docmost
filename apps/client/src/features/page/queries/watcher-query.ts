import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  watchPage,
  unwatchPage,
  getWatchStatus,
} from "@/features/page/services/watcher-service";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const WATCHER_KEY = "watcher";

export function useWatchStatusQuery(pageId: string) {
  return useQuery({
    queryKey: [WATCHER_KEY, pageId],
    queryFn: () => getWatchStatus(pageId),
    enabled: !!pageId,
    staleTime: 60_000,
  });
}

export function useWatchPageMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (pageId: string) => watchPage(pageId),
    onSuccess: (_data, pageId) => {
      queryClient.setQueryData([WATCHER_KEY, pageId], { watching: true });
      notifications.show({ message: t("You are now watching this page") });
    },
  });
}

export function useUnwatchPageMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (pageId: string) => unwatchPage(pageId),
    onSuccess: (_data, pageId) => {
      queryClient.setQueryData([WATCHER_KEY, pageId], { watching: false });
      notifications.show({ message: t("You are no longer watching this page") });
    },
  });
}
