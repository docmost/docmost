import { handleVideoUpload } from "@docmost/editor-ext";
import { uploadFile } from "@/features/page/services/page-service.ts";

export const uploadVideoAction = handleVideoUpload({
  onUpload: async (file: File, pageId: string): Promise<any> => {
    try {
      return await uploadFile(file, pageId);
    } catch (err) {
      console.error("failed to upload image", err);
      throw err;
    }
  },
  validateFn: (file) => {
    if (!file.type.includes("video/")) {
      return false;
    }

    if (file.size / 1024 / 1024 > 20) {
      return false;
    }
    return true;
  },
});
