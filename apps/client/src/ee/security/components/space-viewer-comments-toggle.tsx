import { Group, Text, Switch, Tooltip } from "@mantine/core";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query.ts";
import { useHasFeature } from "@/ee/hooks/use-feature.ts";
import { Feature } from "@/ee/features.ts";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label.ts";

type SpaceViewerCommentsToggleProps = {
  space: ISpace;
};

export default function SpaceViewerCommentsToggle({
  space,
}: SpaceViewerCommentsToggleProps) {
  const { t } = useTranslation();
  const hasViewerComments = useHasFeature(Feature.VIEWER_COMMENTS);
  const upgradeLabel = useUpgradeLabel();
  const isDisabled = !hasViewerComments;
  const [checked, setChecked] = useState(
    space.settings?.comments?.allowViewerComments === true,
  );
  const updateSpaceMutation = useUpdateSpaceMutation();

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      await updateSpaceMutation.mutateAsync({
        spaceId: space.id,
        allowViewerComments: value,
      });
      setChecked(value);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Allow viewers to comment")}</Text>
        <Text size="sm" c="dimmed">
          {t("Allow viewers to add comments on pages in this space.")}
        </Text>
      </div>
      <Tooltip
        label={upgradeLabel}
        disabled={!isDisabled}
        refProp="rootRef"
      >
        <Switch
          checked={checked}
          onChange={handleChange}
          disabled={isDisabled}
          aria-label={t("Toggle viewer comments")}
        />
      </Tooltip>
    </Group>
  );
}
