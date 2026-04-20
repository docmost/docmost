import { Paper, Group, Text, Button } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

type BaseViewDraftBannerProps = {
  isDirty: boolean;
  canSave: boolean;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
};

export function BaseViewDraftBanner({
  isDirty,
  canSave,
  onReset,
  onSave,
  saving,
}: BaseViewDraftBannerProps) {
  const { t } = useTranslation();
  if (!isDirty) return null;
  return (
    <Paper withBorder radius="sm" px="md" py="xs" bg="yellow.0">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <IconInfoCircle size={16} />
          <Text size="sm">
            {t("Filter and sort changes are visible only to you.")}
          </Text>
        </Group>
        <Group gap="sm" wrap="nowrap">
          <Button variant="subtle" color="gray" size="xs" onClick={onReset}>
            {t("Reset")}
          </Button>
          {canSave && (
            <Button size="xs" onClick={onSave} loading={saving}>
              {t("Save for everyone")}
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
