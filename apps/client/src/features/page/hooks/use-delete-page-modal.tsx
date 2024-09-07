import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

type UseDeleteModalProps = {
  onConfirm: () => void;
};

export function useDeletePageModal() {
  const { t } = useTranslation();
  const openDeleteModal = ({ onConfirm }: UseDeleteModalProps) => {
    modals.openConfirmModal({
      title: t("Are you sure you want to delete this page?"),
      children: <Text size="sm">{t("deletePageModalContent")}</Text>,
      centered: true,
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm,
    });
  };

  return { openDeleteModal } as const;
}
