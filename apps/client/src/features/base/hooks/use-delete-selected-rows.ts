import { useCallback } from "react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import { useDeleteRowsMutation } from "@/features/base/queries/base-row-query";

const BATCH_SIZE = 500;

export function useDeleteSelectedRows(baseId: string) {
  const { t } = useTranslation();
  const { selectedIds, clear } = useRowSelection();
  const mutation = useDeleteRowsMutation();

  const deleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      chunks.push(ids.slice(i, i + BATCH_SIZE));
    }
    try {
      for (const chunk of chunks) {
        await mutation.mutateAsync({ baseId, rowIds: chunk });
      }
      notifications.show({
        message: t("{{count}} rows deleted", { count: ids.length }),
      });
      clear();
    } catch {
      // mutation onError already shows notification
    }
  }, [baseId, selectedIds, mutation, clear, t]);

  return { deleteSelected, isPending: mutation.isPending };
}
