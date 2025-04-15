import {
  keepPreviousData,
  useMutation,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  ICreateShare,
  ISharedItem,
  ISharedPageTree,
  IShareInfoInput,
} from "@/features/share/types/share.types.ts";
import {
  createShare,
  deleteShare,
  getSharedPageTree,
  getShareInfo,
  getShares,
  getShareStatus,
  updateShare,
} from "@/features/share/services/share-service.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { IPagination, QueryParams } from "@/lib/types.ts";

export function useGetSharesQuery(
  params?: QueryParams,
): UseQueryResult<IPagination<ISharedItem>, Error> {
  return useQuery({
    queryKey: ["share-list"],
    queryFn: () => getShares(params),
    placeholderData: keepPreviousData,
  });
}

export function useShareQuery(
  shareInput: Partial<IShareInfoInput>,
): UseQueryResult<IPage, Error> {
  const query = useQuery({
    queryKey: ["shares", shareInput],
    queryFn: () => getShareInfo(shareInput),
    enabled: !!shareInput.pageId,
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

export function useGetSharedPageTreeQuery(
  shareId: string,
): UseQueryResult<ISharedPageTree, Error> {
  return useQuery({
    queryKey: ["shared-page-tree", shareId],
    queryFn: () => getSharedPageTree(shareId),
    enabled: !!shareId,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
  });
}
