import { handleAudioUpload } from "@docmost/editor-ext";
import { uploadFile } from "@/features/page/services/page-service.ts";
import { notifications } from "@mantine/notifications";
import { EncryptedPageUploadError } from "@/features/encryption/services/encrypted-pages";
import { getFileUploadSizeLimit } from "@/lib/config.ts";
import { formatBytes } from "@/lib";
import i18n from "@/i18n.ts";

export const uploadAudioAction = handleAudioUpload({
  onUpload: async (file: File, pageId: string): Promise<any> => {
    try {
      return await uploadFile(file, pageId);
    } catch (err) {
      // EncryptedPageUploadError has already told the user why, and carries no
      // response — reaching into one would throw over the top of a clean refusal
      if (!(err instanceof EncryptedPageUploadError)) {
        notifications.show({
          color: "red",
          message: err?.response?.data?.message ?? err?.message,
        });
      }
      throw err;
    }
  },
  validateFn: (file) => {
    if (!file.type.includes("audio/")) {
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
