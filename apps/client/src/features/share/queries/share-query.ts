import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  ICreateShare,
  ISharedItem, ISharedPage,
  ISharedPageTree,
  IShareForPage,
  IShareInfoInput,
  IUpdateShare,
} from '@/features/share/types/share.types.ts';
import {
  createShare,
  deleteShare,
  getSharedPageTree,
  getShareForPage,
  getShareInfo,
  getShares,
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
): UseQueryResult<ISharedPage, Error> {
  const query = useQuery({
    queryKey: ["shares", shareInput],
    queryFn: () => getShareInfo(shareInput),
    enabled: !!shareInput.pageId,
  });

  return query;
}

export function useShareForPageQuery(
  pageId: string,
): UseQueryResult<IShareForPage, Error> {
  const query = useQuery({
    queryKey: ["share-for-page", pageId],
    queryFn: () => getShareForPage(pageId),
    enabled: !!pageId,
    staleTime: 5 * 60 * 1000,
  });

  return query;
}

export function useCreateShareMutation() {
  const { t } = useTranslation();
  return useMutation<any, Error, ICreateShare>({
    mutationFn: (data) => createShare(data),
    onError: (error) => {
      notifications.show({ message: t("Failed to share page"), color: "red" });
    },
  });
}

export function useUpdateShareMutation() {
  const queryClient = useQueryClient();
  return useMutation<any, Error, IUpdateShare>({
    mutationFn: (data) => updateShare(data),
    onSuccess: (data) => {
      queryClient.refetchQueries({
        predicate: (item) =>
          ["share-for-page"].includes(item.queryKey[0] as string),
      });
    },
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
