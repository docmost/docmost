import { Button, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  IntegrationDefinition,
  Integration,
} from "../types/integration.types";
import { getIntegrationIcon } from "./integration-icons";
import IntegrationRowLayout from "./integration-row-layout";
import { getMinimumPlan } from "../utils/minimum-plan";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";
import { UpgradeBadge } from "@/ee/components/upgrade-badge";
import { isCloud } from "@/lib/config.ts";

type IntegrationRowProps = {
  definition: IntegrationDefinition;
  installation?: Integration;
  onInstall: (type: string) => void;
  onUninstall: (integrationId: string) => void;
};

export default function IntegrationRow({
  definition,
  installation,
  onInstall,
  onUninstall,
}: IntegrationRowProps) {
  const { t } = useTranslation();
  const isInstalled = !!installation;
  const hasAccess = useHasFeature(definition.requiresFeature ?? "");
  const locked = !!definition.requiresFeature && !hasAccess;
  const upgradeLabel = useUpgradeLabel();
  const minimumPlan = getMinimumPlan(definition.requiresFeature, isCloud());

  return (
    <IntegrationRowLayout
      icon={getIntegrationIcon(definition.type, 28)}
      name={definition.name}
      badge={locked && <UpgradeBadge label={minimumPlan && t(minimumPlan)} />}
      description={definition.description}
      actions={
        isInstalled ? (
          <Button
            size="xs"
            variant="default"
            onClick={() => onUninstall(installation.id)}
          >
            {t("Uninstall")}
          </Button>
        ) : (
          <Tooltip label={upgradeLabel} disabled={!locked}>
            <Button
              size="xs"
              variant="light"
              disabled={locked}
              onClick={() => onInstall(definition.type)}
            >
              {t("Install")}
            </Button>
          </Tooltip>
        )
      }
    />
  );
}
