import { useEffect, useId, useRef } from "react";
import { Button, Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

type RemoveTimeConfirmationProps = {
  propertyName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RemoveTimeConfirmation({
  propertyName,
  onCancel,
  onConfirm,
}: RemoveTimeConfirmationProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <Stack gap="xs" role="group" aria-labelledby={titleId}>
      <Text id={titleId} size="sm" fw={600}>
        {t("Remove time from {{name}}?", { name: propertyName })}
      </Text>
      <Text size="xs" c="dimmed">
        {t("Cells keep their day in UTC and lose the time.")}
      </Text>
      <Group gap="xs" justify="flex-end">
        <Button ref={cancelRef} variant="default" size="xs" onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button color="red" size="xs" onClick={onConfirm}>
          {t("Remove time")}
        </Button>
      </Group>
    </Stack>
  );
}
