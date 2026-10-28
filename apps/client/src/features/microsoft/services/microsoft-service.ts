import api from "@/lib/api-client";
import {
  M365Drive,
  M365FolderRef,
  M365FolderView,
  M365Item,
  M365Page,
  M365Resolved,
  M365Site,
} from "../types/microsoft.types";

const BASE = "/integrations/microsoft";

export async function resolveMicrosoftUrl(data: { url: string }): Promise<M365Resolved> {
  const req = await api.post<M365Resolved>(`${BASE}/resolve`, data);
  return req.data;
}

export async function getMicrosoftItem(data: { driveId: string; itemId: string }): Promise<M365Item> {
  const req = await api.post<M365Item>(`${BASE}/item`, data);
  return req.data;
}

export async function getMicrosoftPreview(data: {
  driveId: string;
  itemId: string;
}): Promise<{ getUrl: string | null }> {
  const req = await api.post<{ getUrl: string | null }>(`${BASE}/preview`, data);
  return req.data;
}

export async function listMicrosoftRecent(): Promise<M365Item[]> {
  const req = await api.post<{ items: M365Item[] }>(`${BASE}/recent`);
  return req.data.items;
}

export async function listMicrosoftSharedWithMe(): Promise<M365Item[]> {
  const req = await api.post<{ items: M365Item[] }>(`${BASE}/shared-with-me`);
  return req.data.items;
}

export async function listMicrosoftSites(data: { query?: string }): Promise<M365Site[]> {
  const req = await api.post<{ items: M365Site[] }>(`${BASE}/sites`, data);
  return req.data.items;
}

export async function listMicrosoftDrives(data: { siteId: string }): Promise<M365Drive[]> {
  const req = await api.post<{ items: M365Drive[] }>(`${BASE}/drives`, data);
  return req.data.items;
}

export async function listMicrosoftChildren(data: {
  driveId: string;
  itemId?: string;
  pageToken?: string;
}): Promise<M365Page<M365Item>> {
  const req = await api.post<M365Page<M365Item>>(`${BASE}/children`, data);
  return req.data;
}

export async function searchMicrosoft(data: {
  query: string;
  siteId?: string;
  path?: string;
}): Promise<M365Item[]> {
  const req = await api.post<{ items: M365Item[] }>(`${BASE}/search`, data);
  return req.data.items;
}

export async function getMicrosoftFolder(data: {
  driveId: string;
  itemId: string;
}): Promise<M365FolderView> {
  const req = await api.post<M365FolderView>(`${BASE}/folder`, data);
  return req.data;
}

export async function getMicrosoftLibraryRoot(data: {
  siteId: string;
  listId: string;
}): Promise<M365FolderRef> {
  const req = await api.post<M365FolderRef>(`${BASE}/library-root`, data);
  return req.data;
}
