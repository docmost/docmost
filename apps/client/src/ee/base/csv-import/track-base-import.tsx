import { getDefaultStore } from "jotai";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconX } from "@tabler/icons-react";
import { isAxiosError } from "axios";
import i18n from "@/i18n.ts";
import { queryClient } from "@/main";
import { getFileTaskById } from "@/features/file-task/services/file-task-service";
import {
  baseImportProgressAtomFamily,
  baseImportResultAtomFamily,
} from "@/ee/base/atoms/base-atoms";
import type { BaseImportResult } from "@/ee/base/csv-import/csv-import.types";

const POLL_INTERVAL_MS = 3000;

const formatCount = (value: number) => value.toLocaleString(i18n.language);

function progressMessage(processedRows: number, totalRows: number): string {
  if (processedRows === 0) return i18n.t("Waiting to start");
  return i18n.t("{{processed}} of {{total}} rows", {
    processed: formatCount(processedRows),
    total: formatCount(totalRows),
  });
}

function resultMessage(importedRows: number, skippedValues: number): string {
  const rows = i18n.t("{{count}} rows imported", { count: importedRows });
  if (skippedValues === 0) return rows;
  return `${rows} ${i18n.t("{{count}} values left empty", { count: skippedValues })}`;
}

// lives outside React so the toast settles even after the base view unmounts
export function trackBaseImport(input: {
  fileTaskId: string;
  pageId: string;
  totalRows: number;
  skippedValues: number;
}): void {
  const { fileTaskId, pageId, totalRows } = input;
  const store = getDefaultStore();
  const progressAtom = baseImportProgressAtomFamily(pageId);
  const resultAtom = baseImportResultAtomFamily(pageId);
  const notificationId = `base-import-${fileTaskId}`;
  let finished = false;
  let dismissed = false;

  // progress events can beat the upload response
  if (store.get(progressAtom)?.fileTaskId !== fileTaskId) {
    store.set(progressAtom, { fileTaskId, processedRows: 0, totalRows });
  }
  const initial = store.get(progressAtom);
  notifications.show({
    id: notificationId,
    title: i18n.t("Importing CSV"),
    message: progressMessage(initial.processedRows, initial.totalRows),
    loading: true,
    autoClose: false,
    withCloseButton: true,
    onClose: () => {
      dismissed = true;
    },
  });

  const unsubscribeProgress = store.sub(progressAtom, () => {
    const progress = store.get(progressAtom);
    if (finished || progress?.fileTaskId !== fileTaskId) return;
    notifications.update({
      id: notificationId,
      title: i18n.t("Importing CSV"),
      message: progressMessage(progress.processedRows, progress.totalRows),
      loading: true,
      autoClose: false,
      withCloseButton: true,
    });
  });

  const settleOnResult = () => {
    const result = store.get(resultAtom);
    if (result?.fileTaskId === fileTaskId) finish(result);
  };
  const unsubscribeResult = store.sub(resultAtom, settleOnResult);

  const poll = async () => {
    try {
      const task = await getFileTaskById(fileTaskId);
      if (task.status === "processing") return;
      const metadata = task.metadata ?? {};
      finish(
        {
          fileTaskId,
          status: task.status === "success" ? "success" : "failed",
          importedRows: Number(metadata.importedRows ?? 0),
          skippedValues: Number(metadata.skippedValues ?? 0),
          error: task.errorMessage,
        },
        true,
      );
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 403 || status === 404) {
        finish({ fileTaskId, status: "failed", importedRows: 0, skippedValues: 0, error: null });
      }
    }
  };
  const interval = window.setInterval(poll, POLL_INTERVAL_MS);
  // the completion event can also beat the upload response
  settleOnResult();

  // the completion event refreshes the base itself; a polled result means it never came
  function finish(result: BaseImportResult, polled = false) {
    if (finished) return;
    finished = true;
    window.clearInterval(interval);
    unsubscribeProgress();
    unsubscribeResult();
    if (store.get(progressAtom)?.fileTaskId === fileTaskId) store.set(progressAtom, null);

    if (polled && result.status === "success") {
      queryClient.invalidateQueries({ queryKey: ["base-rows", pageId] });
      queryClient.invalidateQueries({ queryKey: ["bases", pageId] });
    }

    // a closed progress toast can't be updated, so the result comes back as a new one
    const notify = dismissed ? notifications.show : notifications.update;
    if (result.status === "success") {
      notify({
        id: notificationId,
        color: "teal",
        title: i18n.t("Import complete"),
        message: resultMessage(result.importedRows, result.skippedValues + input.skippedValues),
        icon: <IconCheck size={18} />,
        loading: false,
        withCloseButton: true,
        autoClose: 8000,
      });
      return;
    }

    notify({
      id: notificationId,
      color: "red",
      title: i18n.t("Import failed"),
      message: result.error || i18n.t("Nothing was imported. Please try again."),
      icon: <IconX size={18} />,
      loading: false,
      withCloseButton: true,
      autoClose: false,
    });
  }
}
