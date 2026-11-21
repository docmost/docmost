import React from "react";
import { Group, Switch, Text, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";
import { getApiErrorMessage } from "@/lib/api-error";
import { useHasFeature } from "@/ee/hooks/use-feature.ts";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label.ts";
import { Feature } from "@/ee/features.ts";
import { UpgradeBadge } from "@/ee/components/upgrade-badge.tsx";

export default function HtmlBlockSettings() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const hasHtmlBlocks = useHasFeature(Feature.HTML_BLOCKS);
  const upgradeLabel = useUpgradeLabel();
  const enabled = workspace?.settings?.htmlBlocks?.enabled === true;
  const allowMembers = workspace?.settings?.htmlBlocks?.allowMembers === true;
  // turning either switch off must work without a license
  const enabledLocked = !hasHtmlBlocks && !enabled;
  const allowMembersLocked = !hasHtmlBlocks && !allowMembers;

  const applyChange = async (data: Partial<IWorkspace>) => {
    try {
      const updatedWorkspace = await updateWorkspace(data);
      setWorkspace(updatedWorkspace);
    } catch (err) {
      notifications.show({
        message: getApiErrorMessage(err, t("Failed to update setting")),
        color: "red",
      });
    }
  };

  const handleEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;

    modals.openConfirmModal({
      title: value ? t("Enable HTML blocks") : t("Disable HTML blocks"),
      children: (
        <Text size="sm">
          {value
            ? t("Are you sure you want to enable HTML blocks?")
            : t("Are you sure you want to disable HTML blocks?")}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Confirm"), cancel: t("Cancel") },
      confirmProps: value ? {} : { color: "red" },
      onConfirm: () => applyChange({ htmlBlocks: value }),
    });
  };

  const handleAllowMembersChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    applyChange({ allowMemberHtmlBlocks: event.currentTarget.checked });
  };

  return (
    <>
      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Group gap="xs" align="center">
            <Text size="md">{t("Allow HTML blocks")}</Text>
            {!hasHtmlBlocks && <UpgradeBadge />}
          </Group>
          <Text size="sm" c="dimmed">
            {t("Let people add blocks with their own HTML, CSS and JavaScript.")}
          </Text>
        </div>

        <Tooltip label={upgradeLabel} disabled={!enabledLocked} refProp="rootRef">
          <Switch
            checked={enabled}
            onChange={handleEnabledChange}
            disabled={enabledLocked}
            aria-label={t("Toggle HTML blocks")}
          />
        </Tooltip>
      </Group>

      <Group justify="space-between" wrap="nowrap" gap="xl" mt="md">
        <div>
          <Text size="md">{t("Allow members to add HTML blocks")}</Text>
          <Text size="sm" c="dimmed">
            {t("Let non-admin members add and edit HTML blocks.")}
          </Text>
        </div>

        <Tooltip
          label={upgradeLabel}
          disabled={!allowMembersLocked}
          refProp="rootRef"
        >
          <Switch
            checked={allowMembers}
            onChange={handleAllowMembersChange}
            disabled={!enabled || allowMembersLocked}
            aria-label={t("Toggle allow members to add HTML blocks")}
          />
        </Tooltip>
      </Group>
    </>
  );
}
