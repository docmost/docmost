import { notifications } from "@mantine/notifications";
import i18n from "@/i18n.ts";

export function notifyDiagramSaveError(err: any) {
  notifications.show({
    color: "red",
    message: err?.response?.data?.message || i18n.t("Failed to save diagram"),
  });
}
