import api from "@/lib/api-client";
import { IPagination } from "@/lib/types";
import {
  IAnnouncement,
  IAnnouncementArchivedParams,
  IAnnouncementBanner,
  IAnnouncementIdInput,
  IAnnouncementInput,
  IUpdateAnnouncementInput,
} from "@/ee/announcement/types/announcement.types";

export async function getCurrentAnnouncements(): Promise<IAnnouncement[]> {
  const req = await api.post<IAnnouncement[]>("/announcements/current");
  return req.data;
}

export async function getArchivedAnnouncements(
  params: IAnnouncementArchivedParams,
): Promise<IPagination<IAnnouncement>> {
  const req = await api.post<IPagination<IAnnouncement>>(
    "/announcements/archived",
    params,
  );
  return req.data;
}

export async function getVisibleAnnouncements(): Promise<IAnnouncementBanner[]> {
  const req = await api.post<IAnnouncementBanner[]>("/announcements/visible");
  return req.data;
}

export async function getPublicAnnouncements(): Promise<IAnnouncementBanner[]> {
  const req = await api.post<IAnnouncementBanner[]>("/announcements/public");
  return req.data;
}

export async function createAnnouncement(
  data: IAnnouncementInput,
): Promise<IAnnouncement> {
  const req = await api.post<IAnnouncement>("/announcements/create", data);
  return req.data;
}

export async function updateAnnouncement(
  data: IUpdateAnnouncementInput,
): Promise<IAnnouncement> {
  const req = await api.post<IAnnouncement>("/announcements/update", data);
  return req.data;
}

export async function archiveAnnouncement(
  data: IAnnouncementIdInput,
): Promise<IAnnouncement> {
  const req = await api.post<IAnnouncement>("/announcements/archive", data);
  return req.data;
}

export async function restoreAnnouncement(
  data: IAnnouncementIdInput,
): Promise<IAnnouncement> {
  const req = await api.post<IAnnouncement>("/announcements/restore", data);
  return req.data;
}

export async function deleteAnnouncement(
  data: IAnnouncementIdInput,
): Promise<void> {
  await api.post("/announcements/delete", data);
}
