import { Text, Switch, Tooltip } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import {
  ResponsiveSettingsRow,
  ResponsiveSettingsContent,
  ResponsiveSettingsControl,
} from "@/components/ui/responsive-settings-row";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label.ts";

export default function RestrictApiToAdmins() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(
    workspace?.settings?.api?.restrictToAdmins === true,
  );
  const hasAccess = useHasFeature(Feature.API_KEYS);
  const upgradeLabel = useUpgradeLabel();

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      const updatedWorkspace = await updateWorkspace({
        restrictApiToAdmins: value,
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
    <ResponsiveSettingsRow>
      <ResponsiveSettingsContent>
        <Text size="md">
          {t("Restrict API key creation to admins")}
        </Text>
        <Text size="sm" c="dimmed">
          {t(
            "Only admins and owners can create new API keys. Existing member keys will continue to work.",
          )}
        </Text>
      </ResponsiveSettingsContent>

      <ResponsiveSettingsControl>
        <Tooltip
          label={upgradeLabel}
          disabled={hasAccess}
          refProp="rootRef"
        >
          <Switch
            checked={checked}
            onChange={handleChange}
            disabled={!hasAccess}
            aria-label={t("Toggle restrict API keys to admins")}
          />
        </Tooltip>
      </ResponsiveSettingsControl>
    </ResponsiveSettingsRow>
  );
}
