import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import {
  useActivateWorkspaceMemberMutation,
  useDeactivateWorkspaceMemberMutation,
  useDeleteWorkspaceMemberMutation,
} from "@/features/workspace/queries/workspace-query.ts";

type UseMemberActionsProps = {
  userId: string;
  isDeactivated: boolean;
  onStatusChange?: () => void;
  onDelete?: () => void;
};

export function useMemberActions({
  userId,
  isDeactivated,
  onStatusChange,
  onDelete,
}: UseMemberActionsProps) {
  const { t } = useTranslation();
  const deleteWorkspaceMemberMutation = useDeleteWorkspaceMemberMutation();
  const deactivateMutation = useDeactivateWorkspaceMemberMutation();
  const activateMutation = useActivateWorkspaceMemberMutation();

  const onDeactivate = async () => {
    await deactivateMutation.mutateAsync({ userId });
    onStatusChange?.();
  };

  const onActivate = async () => {
    await activateMutation.mutateAsync({ userId });
    onStatusChange?.();
  };

  const openDeactivateModal = () =>
    modals.openConfirmModal({
      title: isDeactivated ? t("Activate member") : t("Deactivate member"),
      children: (
        <Text size="sm">
          {isDeactivated
            ? t("Are you sure you want to activate this workspace member?")
            : t(
                "Are you sure you want to deactivate this workspace member? They will no longer be able to access this workspace.",
              )}
        </Text>
      ),
      centered: true,
      labels: {
        confirm: isDeactivated ? t("Activate") : t("Deactivate"),
        cancel: t("Cancel"),
      },
      confirmProps: { color: isDeactivated ? "blue" : "orange" },
      onConfirm: isDeactivated ? onActivate : onDeactivate,
    });

  const onDeleteConfirm = async () => {
    await deleteWorkspaceMemberMutation.mutateAsync({ userId });
    onDelete?.();
  };

  const openDeleteModal = () =>
    modals.openConfirmModal({
      title: t("Delete member"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to delete this workspace member? This action is irreversible.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Delete"), cancel: t("Don't") },
      confirmProps: { color: "red" },
      onConfirm: onDeleteConfirm,
    });

  return { openDeactivateModal, openDeleteModal } as const;
}
