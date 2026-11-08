import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { queryClient } from "@/main.tsx";
import {
  updatePage,
  uploadFile,
} from "@/features/page/services/page-service.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { getFileUploadSizeLimit } from "@/lib/config.ts";
import { formatBytes } from "@/lib";
import { PageCoverUpdate } from "@/features/page-cover/page-cover.types.ts";
import { compressCoverImage } from "@/features/page-cover/compress-cover-image.ts";

function setCachedCover(page: IPage, fields: PageCoverUpdate) {
  for (const key of [page.id, page.slugId]) {
    queryClient.setQueryData<IPage>(["pages", key], (old) =>
      old ? { ...old, ...fields } : old,
    );
  }
}

export function usePageCover(page: IPage) {
  const { t } = useTranslation();
  const emit = useQueryEmit();
  const [isUploading, setIsUploading] = useState(false);
  const mutationKey = ["page-cover", page.id];
  // one queue per page, so requests reach the server in the order they were made
  const scope = { id: `page-cover-${page.id}` };
  // only the newest pending change may touch the cache, older replies would undo it
  const hasNewerChange = () => queryClient.isMutating({ mutationKey }) > 1;

  const applySavedCover = (saved: IPage) => {
    if (hasNewerChange()) return;
    const fields = {
      coverPhoto: saved.coverPhoto,
      coverPosition: saved.coverPosition,
    };
    setCachedCover(page, fields);
    emit({
      operation: "updateOne",
      spaceId: page.spaceId,
      entity: ["pages"],
      id: page.id,
      payload: {
        slugId: page.slugId,
        parentPageId: page.parentPageId,
        ...fields,
      },
    });
  };

  const updateMutation = useMutation({
    mutationKey,
    scope,
    mutationFn: (update: PageCoverUpdate) =>
      updatePage({ pageId: page.id, ...update }),
    onMutate: (update) => {
      const previous: PageCoverUpdate = {
        coverPhoto: page.coverPhoto,
        coverPosition: page.coverPosition,
      };
      const coverChanged =
        update.coverPhoto !== undefined &&
        update.coverPhoto !== page.coverPhoto;
      setCachedCover(page, {
        ...(coverChanged ? { coverPosition: null } : {}),
        ...update,
      });
      return { previous };
    },
    onError: (_error, _update, context) => {
      notifications.show({
        message: t("Failed to update cover"),
        color: "red",
      });
      if (hasNewerChange()) return;
      if (context) setCachedCover(page, context.previous);
      queryClient.invalidateQueries({ queryKey: ["pages", page.slugId] });
    },
    onSuccess: applySavedCover,
  });

  const uploadMutation = useMutation({
    mutationKey,
    scope,
    mutationFn: async (file: File) => {
      const attachment = await uploadFile(file, page.id);
      return updatePage({
        pageId: page.id,
        coverPhoto: `/api/files/${attachment.id}/${attachment.fileName}`,
      });
    },
    onSuccess: applySavedCover,
    onError: (error: any) => {
      notifications.show({
        message: error?.response?.data?.message || t("Failed to upload image"),
        color: "red",
      });
    },
  });

  const uploadCover = async (file: File): Promise<boolean> => {
    setIsUploading(true);
    try {
      const compressed = await compressCoverImage(file).catch(() => null);
      if (!compressed) {
        notifications.show({
          message: t("Failed to upload image"),
          color: "red",
        });
        return false;
      }
      if (compressed.size > getFileUploadSizeLimit()) {
        notifications.show({
          message: t("File exceeds the {{limit}} attachment limit", {
            limit: formatBytes(getFileUploadSizeLimit()),
          }),
          color: "red",
        });
        return false;
      }
      await uploadMutation.mutateAsync(compressed);
      return true;
    } catch {
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    updateCover: updateMutation.mutate,
    uploadCover,
    isUploading,
  };
}
