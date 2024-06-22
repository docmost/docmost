import { handleImageUpload } from "@docmost/editor-ext";
import { uploadFile } from "@/features/page/services/page-service.ts";

export const uploadImageAction = handleImageUpload({
  onUpload: async (file: File, pageId: string): Promise<any> => {
    try {
      return await uploadFile(file, pageId);
    } catch (err) {
      console.error("failed to upload image", err);
      throw err;
    }
  },
  validateFn: (file) => {
    if (!file.type.includes("image/")) {
      return false;
    }
    if (file.size / 1024 / 1024 > 20) {
      //error("File size too big (max 20MB).");
      return false;
    }
    return true;
  },
});
