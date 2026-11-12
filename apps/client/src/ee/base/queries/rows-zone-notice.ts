import type { TFunction } from "i18next";
import { notifications } from "@mantine/notifications";
import { isSameTimeZone } from "@/ee/base/utils/viewer-zone";

export function notifyRowsZone(
  pageId: string,
  serverZone: unknown,
  viewerZone: string,
  t: TFunction,
): void {
  if (
    typeof serverZone !== "string" ||
    isSameTimeZone(serverZone, viewerZone, new Date())
  ) {
    return;
  }
  notifications.show({
    id: "base-rows-zone:" + pageId,
    message: t("Date filters use {{zone}}, not your time zone", {
      zone: serverZone,
    }),
  });
}
