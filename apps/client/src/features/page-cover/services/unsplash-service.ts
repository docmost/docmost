import api from "@/lib/api-client";
import { UnsplashPhotoList } from "@/features/page-cover/page-cover.types.ts";

export async function listUnsplashPhotos(params: {
  query: string;
  page: number;
}): Promise<UnsplashPhotoList> {
  const req = await api.post<UnsplashPhotoList>("/unsplash/photos", params);
  return req.data;
}
