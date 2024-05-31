import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";

type UseDeleteModalProps = {
  onConfirm: () => void;
};

export function useDeletePageModal() {
  const openDeleteModal = ({ onConfirm }: UseDeleteModalProps) => {
    modals.openConfirmModal({
      title: "Are you sure you want to delete this page?",
      children: (
        <Text size="sm">
          Are you sure you want to delete this page? This will delete its
          children and page history. This action is irreversible.
        </Text>
      ),
      centered: true,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm,
    });
  };

  return { openDeleteModal } as const;
}
