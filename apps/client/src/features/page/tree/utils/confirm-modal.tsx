import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";

/**
 * Promise-based wrapper around Mantine's confirm modal, so a drag handler can
 * await the user's decision before it commits anything.
 */
export function confirmModal(options: {
  title: string;
  message: string;
  confirmLabel: string;
  /** required: this helper has no translator of its own */
  cancelLabel: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    modals.openConfirmModal({
      title: options.title,
      children: <Text size="sm">{options.message}</Text>,
      centered: true,
      labels: {
        confirm: options.confirmLabel,
        cancel: options.cancelLabel,
      },
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
      onClose: () => resolve(false),
    });
  });
}
