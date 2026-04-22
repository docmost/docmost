import { useState } from "react";
import { Button, Group, Stack, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";

type PageNameModalOptions = {
  title: string;
  initialValue?: string;
  confirmLabel?: string;
};

type PageNameModalContentProps = {
  initialValue: string;
  confirmLabel: string;
  cancelLabel: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

function PageNameModalContent({
  initialValue,
  confirmLabel,
  cancelLabel,
  onSubmit,
  onCancel,
}: PageNameModalContentProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) {
          return;
        }
        onSubmit(trimmed);
      }}
    >
      <Stack gap="md">
        <TextInput
          autoFocus
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onFocus={(e) => e.currentTarget.select()}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="submit">{confirmLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}

export function usePageNameModal() {
  const { t } = useTranslation();

  const openPageNameModal = ({
    title,
    initialValue = "",
    confirmLabel,
  }: PageNameModalOptions): Promise<string | null> =>
    new Promise((resolve) => {
      const modalId = `page-name-modal-${crypto.randomUUID()}`;
      let settled = false;

      const finalize = (value: string | null) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };

      modals.open({
        modalId,
        title,
        centered: true,
        onClose: () => finalize(null),
        children: (
          <PageNameModalContent
            initialValue={initialValue}
            confirmLabel={confirmLabel ?? t("Save")}
            cancelLabel={t("Cancel")}
            onCancel={() => {
              modals.close(modalId);
              finalize(null);
            }}
            onSubmit={(value) => {
              modals.close(modalId);
              finalize(value);
            }}
          />
        ),
      });
    });

  return { openPageNameModal } as const;
}
