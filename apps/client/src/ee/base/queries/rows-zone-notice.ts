import type { TFunction } from "i18next";
import { notifications } from "@mantine/notifications";
import { isSameTimeZone } from "@/ee/base/utils/viewer-zone";

const notifiedZones = new Map<string, string>();

export function forgetRowsZoneNotices(): void {
  notifiedZones.clear();
}

export function notifyRowsZone(
  pageId: string,
  serverZone: unknown,
  viewerZone: string,
  t: TFunction,
  source: "list" | "calendar" = "list",
): void {
  if (typeof serverZone !== "string") return;
  if (isSameTimeZone(serverZone, viewerZone, new Date())) {
    notifiedZones.delete(pageId);
    return;
  }
  if (notifiedZones.get(pageId) === serverZone) return;
  notifiedZones.set(pageId, serverZone);
  notifications.show({
    id: "base-rows-zone:" + pageId,
    message:
      source === "calendar"
        ? t("This calendar uses {{zone}}, not your time zone", { zone: serverZone })
        : t("Date filters use {{zone}}, not your time zone", { zone: serverZone }),
  });
}
