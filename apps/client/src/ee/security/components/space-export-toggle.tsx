import { Group, Text, Switch, Tooltip } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query.ts";
import { useHasFeature } from "@/ee/hooks/use-feature.ts";
import { Feature } from "@/ee/features.ts";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label.ts";

type SpaceExportToggleProps = {
  space: ISpace;
};

export default function SpaceExportToggle({ space }: SpaceExportToggleProps) {
  const { t } = useTranslation();
  const [workspace] = useAtom(workspaceAtom);
  const workspaceDisabled = workspace?.settings?.export?.disabled === true;
  const hasExportControls = useHasFeature(Feature.EXPORT_CONTROLS);
  const upgradeLabel = useUpgradeLabel();
  const [checked, setChecked] = useState(
    space.settings?.export?.disabled === true,
  );
  const isDisabled = workspaceDisabled || (!hasExportControls && !checked);
  const updateSpaceMutation = useUpdateSpaceMutation();

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      await updateSpaceMutation.mutateAsync({
        spaceId: space.id,
        disableExport: value,
      });
      setChecked(value);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Disable export")}</Text>
        <Text size="sm" c="dimmed">
          {workspaceDisabled
            ? t("Export has been disabled at the workspace level.")
            : t("Prevent pages in this space from being exported.")}
        </Text>
      </div>
      <Tooltip
        label={
          workspaceDisabled
            ? t("Export has been disabled at the workspace level.")
            : upgradeLabel
        }
        disabled={!isDisabled}
        refProp="rootRef"
      >
        <Switch
          checked={checked}
          onChange={handleChange}
          disabled={isDisabled}
          size={"xs"}
          aria-label={t("Toggle space export")}
        />
      </Tooltip>
    </Group>
  );
}
