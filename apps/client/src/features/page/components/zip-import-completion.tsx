import { Anchor } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { saveAs } from "file-saver";
import type { IFileTask } from "@/features/file-task/types/file-task.types";
import i18n from "@/i18n";

export function notifyZipImportComplete(task: IFileTask) {
  const rawWarnings = task.metadata?.warnings;
  const warnings =
    task.source === "confluence" && Array.isArray(rawWarnings)
      ? rawWarnings.filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        )
      : [];

  if (!warnings.length) {
    notifications.update({
      id: "import",
      color: "teal",
      title: i18n.t("Import complete"),
      message: i18n.t("Your pages were successfully imported."),
      icon: <IconCheck size={18} />,
      loading: false,
      withCloseButton: true,
      autoClose: false,
    });
    return;
  }

  const downloadWarnings = () => {
    const blob = new Blob([warnings.join("\n") + "\n"], {
      type: "text/plain;charset=utf-8",
    });
    saveAs(blob, task.fileName.replace(/\.zip$/i, "") + "-warnings.txt");
  };
  // The uploader may already have dismissed the progress notification.
  notifications.hide("import");
  notifications.show({
    id: `import-warnings-${task.id}`,
    color: "yellow",
    title: i18n.t("Import complete with {{count}} warnings", {
      count: warnings.length,
    }),
    message: (
      <Anchor
        component="button"
        type="button"
        size="sm"
        onClick={downloadWarnings}
      >
        {i18n.t("Download warnings")}
      </Anchor>
    ),
    icon: <IconAlertTriangle size={18} />,
    withCloseButton: true,
    autoClose: false,
  });
}
