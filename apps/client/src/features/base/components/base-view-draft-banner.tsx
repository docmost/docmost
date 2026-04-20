import { Group, Button, Tooltip } from "@mantine/core";
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
    <Group justify="flex-end" gap="xs" px="md" py={6} wrap="nowrap">
      <Button variant="subtle" color="gray" size="xs" onClick={onReset}>
        {t("Reset")}
      </Button>
      {canSave && (
        <Tooltip
          label={t("Filter and sort changes are visible only to you")}
          position="bottom"
          withArrow
        >
          <Button
            variant="light"
            color="orange"
            size="xs"
            onClick={onSave}
            loading={saving}
          >
            {t("Save for everyone")}
          </Button>
        </Tooltip>
      )}
    </Group>
  );
}
