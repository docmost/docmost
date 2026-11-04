import { Group, Text, Switch, Tooltip } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
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
          {t(
            "Prevent members from exporting content as Markdown, HTML, PDF, Word, or CSV.",
          )}
        </Text>
      </div>

      <DisableExportToggle />
    </Group>
  );
}

function DisableExportToggle() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(
    workspace?.settings?.export?.disabled === true,
  );
  const hasExportControls = useHasFeature(Feature.EXPORT_CONTROLS);
  const upgradeLabel = useUpgradeLabel();
  // turning it off must work without a license
  const isLocked = !hasExportControls && !checked;

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      const updatedWorkspace = await updateWorkspace({
        disableExport: value,
      });
      setChecked(value);
      setWorkspace(updatedWorkspace);
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message,
        color: "red",
      });
    }
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
