import { Group, Text, Switch, Tooltip } from "@mantine/core";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query.ts";
import { useHasFeature } from "@/ee/hooks/use-feature.ts";
import { Feature } from "@/ee/features.ts";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label.ts";

type SpaceHideCommentsToggleProps = {
  space: ISpace;
};

export default function SpaceHideCommentsToggle({
  space,
}: SpaceHideCommentsToggleProps) {
  const { t } = useTranslation();
  const hasHideComments = useHasFeature(Feature.HIDE_COMMENTS);
  const upgradeLabel = useUpgradeLabel();
  const allowViewerCommentsEnabled =
    space.settings?.comments?.allowViewerComments === true;
  const isDisabled = !hasHideComments || allowViewerCommentsEnabled;
  const tooltipLabel = !hasHideComments
    ? upgradeLabel
    : t("Turn off 'Allow viewers to comment' first");
  const [checked, setChecked] = useState(
    space.settings?.comments?.hideCommentsFromViewers === true,
  );
  const updateSpaceMutation = useUpdateSpaceMutation();

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      await updateSpaceMutation.mutateAsync({
        spaceId: space.id,
        hideCommentsFromViewers: value,
      });
      setChecked(value);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Hide comments from viewers")}</Text>
        <Text size="sm" c="dimmed">
          {t("Viewers cannot see or add comments on pages in this space.")}
        </Text>
      </div>
      <Tooltip label={tooltipLabel} disabled={!isDisabled} refProp="rootRef">
        <Switch
          checked={checked}
          onChange={handleChange}
          disabled={isDisabled}
          aria-label={t("Toggle hide comments from viewers")}
        />
      </Tooltip>
    </Group>
  );
}
