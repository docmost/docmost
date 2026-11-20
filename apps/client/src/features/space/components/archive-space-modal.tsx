import { Button, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import {
  useArchiveSpaceMutation,
  useUnarchiveSpaceMutation,
} from "@/features/space/queries/space-query.ts";
import { ISpace } from "@/features/space/types/space.types.ts";

type ArchiveSpaceModalProps = {
  space: ISpace;
};

export default function ArchiveSpaceModal({ space }: ArchiveSpaceModalProps) {
  const { t } = useTranslation();
  const archiveSpaceMutation = useArchiveSpaceMutation();
  const unarchiveSpaceMutation = useUnarchiveSpaceMutation();

  if (space.archivedAt) {
    return (
      <Button
        variant="default"
        onClick={() => unarchiveSpaceMutation.mutate(space.id)}
        loading={unarchiveSpaceMutation.isPending}
      >
        {t("Restore")}
      </Button>
    );
  }

  const openArchiveConfirm = () =>
    modals.openConfirmModal({
      title: t("Archive space"),
      children: (
        <Text size="sm">
          {t("Are you sure you want to archive this space?")}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Archive"), cancel: t("Cancel") },
      onConfirm: () => archiveSpaceMutation.mutate(space.id),
    });

  return (
    <Button
      variant="default"
      onClick={openArchiveConfirm}
      loading={archiveSpaceMutation.isPending}
    >
      {t("Archive")}
    </Button>
  );
}
