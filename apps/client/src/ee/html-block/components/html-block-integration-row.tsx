import { Button, Stack, Text, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";
import IntegrationRowLayout from "@/features/integration/components/integration-row-layout.tsx";
import { getMinimumPlan } from "@/features/integration/utils/minimum-plan.ts";
import { Html5Icon } from "@/components/icons";
import { getApiErrorMessage } from "@/lib/api-error";
import { isCloud, isDisableHtmlBlocks } from "@/lib/config.ts";
import { useHasFeature } from "@/ee/hooks/use-feature.ts";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label.ts";
import { Feature } from "@/ee/features.ts";
import { UpgradeBadge } from "@/ee/components/upgrade-badge.tsx";

export default function HtmlBlockIntegrationRow() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const hasHtmlBlocks = useHasFeature(Feature.HTML_BLOCKS);
  const upgradeLabel = useUpgradeLabel();
  const disabledOnServer = isDisableHtmlBlocks();
  const enabled =
    !disabledOnServer && workspace?.settings?.htmlBlocks?.enabled === true;
  // turning HTML blocks off must work without a license
  const enableLocked = disabledOnServer || (!hasHtmlBlocks && !enabled);
  const minimumPlan = getMinimumPlan(Feature.HTML_BLOCKS, isCloud());

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

  const confirmEnabledChange = (value: boolean) => {
    modals.openConfirmModal({
      title: value ? t("Enable HTML blocks") : t("Disable HTML blocks"),
      children: value ? (
        <Stack gap="xs">
          <Text size="sm">
            {t(
              "Everyone who can edit a page will be able to add their own HTML, CSS and JavaScript. It runs in the browser of everyone who views the page, including people opening a shared link.",
            )}
          </Text>
          <Text size="sm">
            {t(
              "Only enable HTML blocks if you trust everyone who can edit pages.",
            )}
          </Text>
        </Stack>
      ) : (
        <Text size="sm">
          {t("Are you sure you want to disable HTML blocks?")}
        </Text>
      ),
      centered: true,
      labels: {
        confirm: value ? t("Enable") : t("Disable"),
        cancel: t("Cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: () => applyChange({ htmlBlocks: value }),
    });
  };

  return (
    <IntegrationRowLayout
      icon={<Html5Icon size={28} />}
      name={t("HTML blocks")}
      badge={
        !hasHtmlBlocks && <UpgradeBadge label={minimumPlan && t(minimumPlan)} />
      }
      description={
        disabledOnServer
          ? t("Turned off on this server")
          : t("Let people add their own HTML, CSS and JavaScript to pages")
      }
      actions={
        enabled ? (
          <Button
            size="xs"
            variant="default"
            onClick={() => confirmEnabledChange(false)}
            aria-label={t("Disable HTML blocks")}
          >
            {t("Disable")}
          </Button>
        ) : (
          <Tooltip
            label={
              disabledOnServer ? t("Turned off on this server") : upgradeLabel
            }
            disabled={!enableLocked}
          >
            <Button
              size="xs"
              variant="light"
              disabled={enableLocked}
              onClick={() => confirmEnabledChange(true)}
              aria-label={t("Enable HTML blocks")}
            >
              {t("Enable")}
            </Button>
          </Tooltip>
        )
      }
    />
  );
}
