import { Button, Divider, Group } from "@mantine/core";
import { useTranslation } from "react-i18next";

export function OptionsFooter({
  isDirty,
  onCancel,
  onSave,
}: {
  isDirty: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Divider />
      <Group justify="flex-end" gap="xs">
        <Button variant="default" size="xs" onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button size="xs" onClick={onSave} disabled={!isDirty}>
          {t("Save")}
        </Button>
      </Group>
    </>
  );
}
