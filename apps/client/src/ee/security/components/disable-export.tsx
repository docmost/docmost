import { Group, Text, Switch, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import { getApiErrorMessage } from "@/lib/api-error";
import { useHasFeature } from "@/ee/hooks/use-feature.ts";
import { Feature } from "@/ee/features.ts";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label.ts";

export default function DisableExport() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Disable export")}</Text>
        <Text size="sm" c="dimmed">
          {t("Prevent members from exporting content.")}
        </Text>
      </div>

      <DisableExportToggle />
    </Group>
  );
}

function DisableExportToggle() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const checked = workspace?.settings?.export?.disabled === true;
  const hasExportControls = useHasFeature(Feature.EXPORT_CONTROLS);
  const upgradeLabel = useUpgradeLabel();
  // turning it off must work without a license
  const isLocked = !hasExportControls && !checked;

  const applyChange = async (value: boolean) => {
    try {
      const updatedWorkspace = await updateWorkspace({
        disableExport: value,
      });
      setWorkspace(updatedWorkspace);
    } catch (err) {
      notifications.show({
        message: getApiErrorMessage(err, t("Failed to update setting")),
        color: "red",
      });
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;

    modals.openConfirmModal({
      title: value ? t("Disable export") : t("Enable export"),
      children: (
        <Text size="sm">
          {value
            ? t(
                "Are you sure you want to disable export? No one in this workspace, including admins, will be able to export content.",
              )
            : t(
                "Are you sure you want to enable export? Members will be able to export content.",
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
    <Tooltip label={upgradeLabel} disabled={!isLocked} refProp="rootRef">
      <Switch
        checked={checked}
        onChange={handleChange}
        disabled={isLocked}
        aria-label={t("Toggle export")}
      />
    </Tooltip>
  );
}
