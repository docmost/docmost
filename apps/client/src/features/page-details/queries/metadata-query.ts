import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { updatePage } from "@/features/page/services/page-service";
import { IPage, PageMetadata } from "@/features/page/types/page.types";
import {
  invalidateOnUpdatePage,
} from "@/features/page/queries/page-query";

/**
 * 更新页面元数据的 mutation hook。
 * 复用 updatePage API，全量替换 metadata。
 * 乐观更新：同时刷新 UUID 和 slugId 两种缓存 key（同 updatePageData 模式）。
 */
export function useUpdatePageMetadata(pageId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IPage, Error, PageMetadata>({
    mutationFn: (metadata) => updatePage({ pageId, metadata }),
    onSuccess: (updatedPage) => {
      // 同时更新 UUID key 和 slugId key 的缓存
      const cachedBySlug = queryClient.getQueryData<IPage>([
        "pages",
        updatedPage.slugId,
      ]);
      const cachedById = queryClient.getQueryData<IPage>([
        "pages",
        updatedPage.id,
      ]);

      if (cachedBySlug) {
        queryClient.setQueryData<IPage>(
          ["pages", updatedPage.slugId],
          { ...cachedBySlug, ...updatedPage },
        );
      }

      if (cachedById) {
        queryClient.setQueryData<IPage>(
          ["pages", updatedPage.id],
          { ...cachedById, ...updatedPage },
        );
      }

      // 同时更新侧边栏缓存
      invalidateOnUpdatePage(
        updatedPage.spaceId,
        updatedPage.parentPageId,
        updatedPage.id,
        updatedPage.title,
        updatedPage.icon,
      );
    },
    onError: (error: any) => {
      notifications.show({
        message:
          error?.response?.data?.message ??
          t("Failed to update metadata"),
        color: "red",
      });
    },
  });
}
