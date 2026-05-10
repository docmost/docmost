import api from "@/lib/api-client";
import { IPagination } from "@/lib/types.ts";
import { IFavorite, FavoriteType } from "../types/favorite.types";

export type ToggleFavoriteParams = {
  type: FavoriteType;
  pageId?: string;
  spaceId?: string;
  templateId?: string;
};

export async function addFavorite(
  params: ToggleFavoriteParams,
): Promise<void> {
  await api.post("/favorites/add", params);
}

export async function removeFavorite(
  params: ToggleFavoriteParams,
): Promise<void> {
  await api.post("/favorites/remove", params);
}

export async function getFavoriteIds(type: FavoriteType, spaceId?: string): Promise<IPagination<string>> {
  const req = await api.post<IPagination<string>>("/favorites/ids", { type, spaceId });
  return req.data;
}

export async function getFavorites(params?: {
  type?: FavoriteType;
  spaceId?: string;
  limit?: number;
  cursor?: string;
}): Promise<IPagination<IFavorite>> {
  const req = await api.post("/favorites", params);
  return req.data;
}
