import { handleVideoUpload, UploadTarget } from "@docmost/editor-ext";
import { uploadFile } from "@/features/page/services/page-service.ts";
import { notifications } from "@mantine/notifications";
import { getFileUploadSizeLimit } from "@/lib/config.ts";
import { formatBytes } from "@/lib";
import i18n from "@/i18n.ts";

export const uploadVideoAction = handleVideoUpload({
  onUpload: async (file: File, uploadTarget: UploadTarget): Promise<any> => {
    try {
      return await uploadFile(file, uploadTarget);
    } catch (err) {
      notifications.show({
        color: "red",
        message: err?.response.data.message,
      });
      throw err;
    }
  },
  validateFn: (file) => {
    if (!file.type.includes("video/")) {
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
