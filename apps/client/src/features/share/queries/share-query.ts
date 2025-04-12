import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { validate as isValidUuid } from "uuid";
import { useTranslation } from "react-i18next";
import {
  ICreateShare,
  IShareInfoInput,
} from "@/features/share/types/share.types.ts";
import {
  createShare,
  deleteShare,
  getShareInfo,
  getShareStatus,
  updateShare,
} from "@/features/share/services/share-service.ts";
import { IPage } from "@/features/page/types/page.types.ts";

export function useShareQuery(
  shareInput: Partial<IShareInfoInput>,
): UseQueryResult<IPage, Error> {
  const query = useQuery({
    queryKey: ["shares", shareInput],
    queryFn: () => getShareInfo(shareInput),
    enabled: !!shareInput.pageId,
    staleTime: 5 * 60 * 1000,
  });

  return query;
}

export function useShareStatusQuery(
  pageId: string,
): UseQueryResult<IPage, Error> {
  const query = useQuery({
    queryKey: ["share-status", pageId],
    queryFn: () => getShareStatus(pageId),
    enabled: !!pageId,
    staleTime: 5 * 60 * 1000,
  });

  return query;
}

export function useCreateShareMutation() {
  const { t } = useTranslation();
  return useMutation<any, Error, ICreateShare>({
    mutationFn: (data) => createShare(data),
    onSuccess: (data) => {},
    onError: (error) => {
      notifications.show({ message: t("Failed to share page"), color: "red" });
    },
  });
}

export function useUpdateShareMutation() {
  return useMutation<any, Error, Partial<IShareInfoInput>>({
    mutationFn: (data) => updateShare(data),
  });
}

export function useDeleteShareMutation() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (shareId: string) => deleteShare(shareId),
    onSuccess: () => {
      notifications.show({ message: t("Share deleted successfully") });
    },
    onError: (error) => {
      notifications.show({
        message: t("Failed to delete share"),
        color: "red",
      });
    },
  });
}
