import { useCallback } from "react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import { useDeleteRowsMutation } from "@/features/base/queries/base-row-query";

const BATCH_SIZE = 500;

export function useDeleteSelectedRows(baseId: string) {
  const { t } = useTranslation();
  const { selectedIds, clear } = useRowSelection();
  const mutation = useDeleteRowsMutation();

  const runDelete = useCallback(
    async (ids: string[]) => {
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
    },
    [baseId, mutation, clear, t],
  );

  const deleteSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    modals.openConfirmModal({
      title: t("Delete {{count}} rows?", { count: ids.length }),
      centered: true,
      children: (
        <Text size="sm">
          {t("This action cannot be undone.")}
        </Text>
      ),
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => void runDelete(ids),
    });
  }, [selectedIds, runDelete, t]);

  return { deleteSelected, isPending: mutation.isPending };
}
