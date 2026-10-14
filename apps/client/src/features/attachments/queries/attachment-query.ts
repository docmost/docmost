import {
  InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
  UseInfiniteQueryResult,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  deleteAttachment,
  getPageAttachments,
} from "@/features/attachments/services/attachment-service.ts";
import { IPageAttachment } from "@/features/attachments/types/attachment.types.ts";
import { IPagination } from "@/lib/types.ts";

export function usePageAttachmentsQuery(
  pageId: string,
  search?: string,
): UseInfiniteQueryResult<InfiniteData<IPagination<IPageAttachment>, unknown>> {
  return useInfiniteQuery({
    queryKey: ["page-attachments", pageId, search],
    queryFn: ({ pageParam }) =>
      getPageAttachments(pageId, { cursor: pageParam, query: search }),
    enabled: !!pageId,
    gcTime: 0,
    placeholderData: keepPreviousData,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  });
}

export function useDeleteAttachmentMutation(pageId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (attachmentId) => deleteAttachment(attachmentId),
    onSuccess: (_data, attachmentId) => {
      queryClient.setQueriesData<InfiniteData<IPagination<IPageAttachment>>>(
        { queryKey: ["page-attachments", pageId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== attachmentId),
            })),
          };
        },
      );
      notifications.show({ message: t("Attachment deleted") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to delete attachment"),
        color: "red",
      });
    },
  });
}
