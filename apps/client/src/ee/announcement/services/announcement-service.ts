import api from "@/lib/api-client";
import { IPagination } from "@/lib/types";
import {
  IAnnouncement,
  IAnnouncementIdInput,
  IAnnouncementInput,
  IAnnouncementListParams,
  IUpdateAnnouncementInput,
  IVisibleAnnouncements,
} from "@/ee/announcement/types/announcement.types";

export async function getAnnouncements(
  params: IAnnouncementListParams,
): Promise<IPagination<IAnnouncement>> {
  const req = await api.post<IPagination<IAnnouncement>>(
    "/announcements",
    params,
  );
  return req.data;
}

export async function getVisibleAnnouncements(): Promise<IVisibleAnnouncements> {
  const req = await api.post<IVisibleAnnouncements>("/announcements/visible");
  return req.data;
}

export async function getPublicAnnouncements(): Promise<IVisibleAnnouncements> {
  const req = await api.post<IVisibleAnnouncements>("/announcements/public");
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

export async function unarchiveAnnouncement(
  data: IAnnouncementIdInput,
): Promise<IAnnouncement> {
  const req = await api.post<IAnnouncement>("/announcements/unarchive", data);
  return req.data;
}

export async function deleteAnnouncement(
  data: IAnnouncementIdInput,
): Promise<void> {
  await api.post("/announcements/delete", data);
}
