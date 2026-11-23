import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button, Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  loading?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PropertyChangeConfirmation({
  title, description, confirmLabel, destructive, loading, children, onCancel, onConfirm,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <Stack gap="xs" role="group" aria-labelledby={titleId}>
      <Text id={titleId} size="sm" fw={600}>{title}</Text>
      <Text size="xs" c="dimmed">{description}</Text>
      {children}
      <Group gap="xs" justify="flex-end">
        <Button ref={cancelRef} variant="default" size="xs" onClick={onCancel}>{t("Cancel")}</Button>
        <Button color={destructive ? "red" : undefined} size="xs" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Group>
    </Stack>
  );
}
