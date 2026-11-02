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
        {t("Unarchive")}
      </Button>
    );
  }

  const openArchiveConfirm = () =>
    modals.openConfirmModal({
      title: t("Archive this space?"),
      children: (
        <Text size="sm">
          {t(
            "The space is hidden from the space list, from search outside the space, from AI answers and from connected AI apps. Members keep access and can still edit it. Public links pause until you unarchive it.",
          )}
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
