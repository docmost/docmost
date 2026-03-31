import { Group, Text, Switch, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query.ts";

type SpacePublicSharingToggleProps = {
  space: ISpace;
};

export default function SpacePublicSharingToggle({
  space,
}: SpacePublicSharingToggleProps) {
  const { t } = useTranslation();
  const [workspace] = useAtom(workspaceAtom);
  const workspaceDisabled = workspace?.settings?.sharing?.disabled === true;
  const [checked, setChecked] = useState(
    space.settings?.sharing?.disabled === true,
  );
  const updateSpaceMutation = useUpdateSpaceMutation();

  const applyChange = async (value: boolean) => {
    try {
      await updateSpaceMutation.mutateAsync({
        spaceId: space.id,
        disablePublicSharing: value,
      });
      setChecked(value);
    } catch {
      // error handled by mutation
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;

    modals.openConfirmModal({
      title: value ? t("Disable public sharing") : t("Enable public sharing"),
      children: (
        <Text size="sm">
          {value
            ? t(
                "Are you sure you want to disable public sharing? All existing shared links in this space will be deleted.",
              )
            : t(
                "Are you sure you want to enable public sharing for this space?",
              )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Confirm"), cancel: t("Cancel") },
      confirmProps: value ? { color: "red" } : {},
      onConfirm: () => applyChange(value),
    });
  };

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Disable public sharing")}</Text>
        <Text size="sm" c="dimmed">
          {workspaceDisabled
            ? t("Public sharing is disabled at the workspace level")
            : t("Prevent pages in this space from being shared publicly.")}
        </Text>
      </div>
      <Tooltip
        label={t("Public sharing is disabled at the workspace level")}
        disabled={!workspaceDisabled}
        refProp="rootRef"
      >
        <Switch
          checked={checked}
          onChange={handleChange}
          disabled={workspaceDisabled}
          aria-label={t("Toggle space public sharing")}
        />
      </Tooltip>
    </Group>
  );
}
