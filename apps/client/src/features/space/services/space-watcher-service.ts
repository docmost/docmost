import api from "@/lib/api-client";
import { IPagination } from "@/lib/types";

export async function watchSpace(
  spaceId: string,
): Promise<{ watching: boolean }> {
  const req = await api.post<{ watching: boolean }>("/spaces/watch", {
    spaceId,
  });
  return req.data;
}

export async function unwatchSpace(
  spaceId: string,
): Promise<{ watching: boolean }> {
  const req = await api.post<{ watching: boolean }>("/spaces/unwatch", {
    spaceId,
  });
  return req.data;
}

export async function getWatchedSpaceIds(): Promise<IPagination<string>> {
  const req = await api.post<IPagination<string>>("/spaces/watched-ids");
  return req.data;
}

export async function getSpaceWatchStatus(
  spaceId: string,
): Promise<{ watching: boolean }> {
  const req = await api.post<{ watching: boolean }>("/spaces/watch-status", {
    spaceId,
  });
  return req.data;
}
