import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ISiemDestination } from "@/ee/siem/types/siem.types";
import { useDeleteSiemDestinationMutation } from "@/ee/siem/queries/siem-query";

interface DeleteDestinationModalProps {
  opened: boolean;
  onClose: () => void;
  destination: ISiemDestination | null;
}

export function DeleteDestinationModal({ opened, onClose, destination }: DeleteDestinationModalProps) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteSiemDestinationMutation();

  const handleDelete = async () => {
    if (!destination) return;
    await deleteMutation.mutateAsync({ destinationId: destination.id });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Delete destination")}
      size="md"
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      <Stack gap="md">
        <Text>
          {t("Are you sure you want to delete the destination")}{" "}
          <strong>{destination?.name}</strong>?
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>{t("Cancel")}</Button>
          <Button color="red" onClick={handleDelete} loading={deleteMutation.isPending}>
            {t("Delete")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
