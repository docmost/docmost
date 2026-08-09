import { Text, Alert, Stack } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import { getAppName } from "@/lib/config";
import SettingsTitle from "@/components/settings/settings-title";
import IntegrationRow from "../components/integration-row";
import IntegrationListSkeleton from "../components/integration-list-skeleton";
import {
  useAvailableIntegrations,
  useInstalledIntegrations,
  useInstallIntegration,
  useUninstallIntegration,
  useUpdateIntegrationSettings,
} from "../queries/integration-query";
import { Integration } from "../types/integration.types";
import {
  getOAuthAuthorizeUrl,
  getOAuthInstallUrl,
} from "../services/integration-service";
import { notifications } from "@mantine/notifications";

export default function Integrations() {
  const { t } = useTranslation();
  const { data: available, isLoading: loadingAvailable } =
    useAvailableIntegrations();
  const { data: installed, isLoading: loadingInstalled } =
    useInstalledIntegrations();
  const installMutation = useInstallIntegration();
  const uninstallMutation = useUninstallIntegration();
  const updateMutation = useUpdateIntegrationSettings();

  const handleInstall = useCallback(
    async (type: string) => {
      const definition = available?.find((d) => d.type === type);

      // Workspace-scoped (Slack): the install row is only persisted when the
      // OAuth callback succeeds. Skip the upfront install API call entirely.
      if (definition?.oauth?.connectionScope === "workspace") {
        try {
          const { authorizationUrl } = await getOAuthInstallUrl({ type });
          window.location.href = authorizationUrl;
        } catch (err: any) {
          notifications.show({
            message:
              err?.response?.data?.message ?? t("Failed to start installation"),
            color: "red",
          });
        }
        return;
      }

      // Per-user OAuth providers (Linear, Jira, GitHub, ...): keep existing
      // two-step flow — create the integration row, then individual users
      // OAuth-connect from /settings/account/connections.
      installMutation.mutate({ type });
    },
    [installMutation, available, t],
  );

  const handleUninstall = useCallback(
    (integrationId: string) => {
      uninstallMutation.mutate({ integrationId });
    },
    [uninstallMutation],
  );

  const handleToggle = useCallback(
    (integration: Integration, enabled: boolean) => {
      updateMutation.mutate({
        integrationId: integration.id,
        isEnabled: enabled,
      });
    },
    [updateMutation],
  );

  const isLoading = loadingAvailable || loadingInstalled;
  const error = new URLSearchParams(window.location.search).get("error");

  return (
    <>
      <Helmet>
        <title>
          {t("Integrations")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("Integrations")} />

      <Text size="sm" c="dimmed" mb="md">
        {t("Manage workspace integrations.")}
      </Text>

      {error === "oauth_failed" && (
        <Alert color="red" mb="md">
          {t("OAuth connection failed. Please try again.")}
        </Alert>
      )}

      {isLoading ? (
        <IntegrationListSkeleton />
      ) : !available?.length ? (
        <Text c="dimmed" size="sm">
          {t("No integrations available.")}
        </Text>
      ) : (
        <Stack gap={0}>
          {available.map((def) => {
            const installation = installed?.find((i) => i.type === def.type);
            return (
              <IntegrationRow
                key={def.type}
                definition={def}
                installation={installation}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onToggle={handleToggle}
              />
            );
          })}
        </Stack>
      )}
    </>
  );
}
