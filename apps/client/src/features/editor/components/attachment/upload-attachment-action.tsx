import { handleAttachmentUpload } from "@docmost/editor-ext";
import { uploadFile } from "@/features/page/services/page-service.ts";
import { notifications } from "@mantine/notifications";
import { getFileUploadSizeLimit } from "@/lib/config.ts";
import { formatBytes } from "@/lib";
import i18n from "@/i18n.ts";
import { Progress, Text } from "@mantine/core";
import React from "react";

export const uploadAttachmentAction = handleAttachmentUpload({
  onUpload: async (file: File, pageId: string): Promise<any> => {
    const notificationId = `upload-${file.name}-${Date.now()}`;
    notifications.show({
      id: notificationId,
      title: i18n.t("Uploading attachment"),
      message: i18n.t("Uploading {{fileName}}...", { fileName: file.name }),
      loading: true,
      autoClose: false,
      withCloseButton: false,
    });

    try {
      const result = await uploadFile(file, pageId, undefined, (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || file.size)
        );

        notifications.update({
          id: notificationId,
          title: i18n.t("Uploading attachment"),
          message: (
            <div>
              <Text size="xs" mb={5}>
                {i18n.t("Uploading {{fileName}}", { fileName: file.name })} (
                {percentCompleted}%)
              </Text>
              <Progress
                value={percentCompleted}
                size="sm"
                radius="xl"
                animated
              />
            </div>
          ),
          loading: true,
          autoClose: false,
          withCloseButton: false,
        });
      });

      notifications.hide(notificationId);
      return result;
    } catch (err) {
      notifications.update({
        id: notificationId,
        color: "red",
        title: i18n.t("Upload failed"),
        message: err?.response?.data?.message || i18n.t("Failed to upload attachment"),
        loading: false,
        autoClose: 5000,
        withCloseButton: true,
      });
      throw err;
    }
  },
  validateFn: (file, allowMedia: boolean) => {
    if (
      (file.type.includes("image/") || file.type.includes("video/")) &&
      !allowMedia
    ) {
      return false;
    }
    if (file.size > getFileUploadSizeLimit()) {
      notifications.show({
        color: "red",
        message: i18n.t("File exceeds the {{limit}} attachment limit", {
          limit: formatBytes(getFileUploadSizeLimit()),
        }),
      });
      return false;
    }

    return true;
  },
});
