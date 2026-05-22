import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

type UseRestoreModalProps = {
  title?: string | null;
  onConfirm: () => void;
};

export function useRestorePageModal() {
  const { t } = useTranslation();
  const openRestoreModal = ({ title, onConfirm }: UseRestoreModalProps) => {
    modals.openConfirmModal({
      title: t("Restore page"),
      children: (
        <Text size="sm">
          {t("Restore '{{title}}' and its sub-pages?", {
            title: title || t("Untitled"),
          })}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Restore"), cancel: t("Cancel") },
      confirmProps: { color: "blue" },
      onConfirm,
    });
  };

  return { openRestoreModal } as const;
}
