import api from "@/lib/api-client";
import { IAttachment } from "@/features/attachments/types/attachment.types.ts";
import { UnsplashPhotoList } from "@/features/page-cover/page-cover.types.ts";

export async function uploadCoverImage(
  file: File,
  pageId: string,
): Promise<IAttachment> {
  const formData = new FormData();
  // fields go before the file, the server only reads those that arrive first
  formData.append("pageId", pageId);
  formData.append("type", "page-cover");
  formData.append("file", file);

  const req = await api.post<IAttachment>("/files/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return req as unknown as IAttachment;
}

export async function listUnsplashPhotos(params: {
  query: string;
  page: number;
  pageId: string;
}): Promise<UnsplashPhotoList> {
  const req = await api.post<UnsplashPhotoList>("/unsplash/photos", params);
  return req.data;
}
