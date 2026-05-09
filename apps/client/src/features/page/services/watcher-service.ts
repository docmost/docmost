import api from "@/lib/api-client";

export async function watchPage(pageId: string): Promise<{ watching: boolean }> {
  const req = await api.post<{ watching: boolean }>("/pages/watch", { pageId });
  return req.data;
}

export async function unwatchPage(pageId: string): Promise<{ watching: boolean }> {
  const req = await api.post<{ watching: boolean }>("/pages/unwatch", { pageId });
  return req.data;
}

export async function getWatchStatus(pageId: string): Promise<{ watching: boolean }> {
  const req = await api.post<{ watching: boolean }>("/pages/watch-status", { pageId });
  return req.data;
}
