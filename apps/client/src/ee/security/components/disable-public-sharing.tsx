import { Group, Text, Switch, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import useEnterpriseAccess from "@/ee/hooks/use-enterprise-access.tsx";

export default function DisablePublicSharing() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Text size="md">{t("Disable public sharing")}</Text>
          <Text size="sm" c="dimmed">
            {t("Prevent members from sharing pages publicly.")}
          </Text>
        </div>

        <DisablePublicSharingToggle />
    </Group>
  );
}

function DisablePublicSharingToggle() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(
    workspace?.settings?.sharing?.disabled === true,
  );
  const hasAccess = useEnterpriseAccess();

  const applyChange = async (value: boolean) => {
    try {
      const updatedWorkspace = await updateWorkspace({
        disablePublicSharing: value,
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

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;

    modals.openConfirmModal({
      title: value ? t("Disable public sharing") : t("Enable public sharing"),
      children: (
        <Text size="sm">
          {value
            ? t(
                "Are you sure you want to disable public sharing? All existing shared links in this workspace will be deleted.",
              )
            : t(
                "Are you sure you want to enable public sharing? Members will be able to share pages publicly.",
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
    <Tooltip
      label={t("Requires an enterprise license")}
      disabled={hasAccess}
      refProp="rootRef"
    >
      <Switch
        checked={checked}
        onChange={handleChange}
        disabled={!hasAccess}
        aria-label={t("Toggle public sharing")}
      />
    </Tooltip>
  );
}
