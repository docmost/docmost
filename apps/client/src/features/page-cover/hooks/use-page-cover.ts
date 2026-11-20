import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { queryClient } from "@/main.tsx";
import { updatePage } from "@/features/page/services/page-service.ts";
import { uploadCoverImage } from "@/features/page-cover/services/page-cover-service.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import {
  CoverChange,
  PageCoverFields,
  UnsplashPhoto,
} from "@/features/page-cover/page-cover.types.ts";
import { compressCoverImage } from "@/features/page-cover/compress-cover-image.ts";
import {
  isSameUnsplashPhoto,
  toUnsplashCoverValue,
} from "@/features/page-cover/page-cover.utils.ts";

function setCachedCover(page: IPage, fields: PageCoverFields) {
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
    const fields: PageCoverFields = {
      coverPhoto: saved.coverPhoto,
      coverPosition: saved.coverPosition,
      coverAttribution: saved.coverAttribution ?? null,
    };
    // the same photo saved under a new address keeps the image already loaded
    const shown = queryClient.getQueryData<IPage>(["pages", page.slugId]);
    setCachedCover(
      page,
      isSameUnsplashPhoto(shown, fields)
        ? { ...fields, coverPhoto: shown.coverPhoto }
        : fields,
    );
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mutationFn: ({ preview, ...update }: CoverChange) =>
      updatePage({ pageId: page.id, ...update }),
    onMutate: ({ preview, ...update }) => {
      const previous: PageCoverFields = {
        coverPhoto: page.coverPhoto,
        coverPosition: page.coverPosition,
        coverAttribution: page.coverAttribution ?? null,
      };
      const coverChanged =
        update.coverPhoto !== undefined &&
        update.coverPhoto !== page.coverPhoto;
      setCachedCover(page, {
        ...(coverChanged ? { coverPosition: null, coverAttribution: null } : {}),
        ...update,
        ...preview,
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
      const attachment = await uploadCoverImage(file, page.id);
      return updatePage({
        pageId: page.id,
        coverPhoto: `/api/files/${attachment.id}/${encodeURIComponent(attachment.fileName)}`,
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
      await uploadMutation.mutateAsync(compressed);
      return true;
    } catch {
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const selectUnsplashPhoto = (photo: UnsplashPhoto) => {
    updateMutation.mutate({
      coverPhoto: toUnsplashCoverValue(photo.id),
      preview: {
        coverPhoto: photo.coverUrl,
        coverAttribution: {
          source: "unsplash",
          photoId: photo.id,
          authorName: photo.authorName,
          authorUsername: photo.authorUsername,
        },
      },
    });
  };

  return {
    updateCover: updateMutation.mutate,
    uploadCover,
    selectUnsplashPhoto,
    isUploading,
  };
}
