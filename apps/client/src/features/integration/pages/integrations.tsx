import { Text, Alert, Stack } from "@mantine/core";
import { modals } from "@mantine/modals";
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
} from "../queries/integration-query";
import { getOAuthInstallUrl } from "../services/integration-service";
import { notifications } from "@mantine/notifications";

export default function Integrations() {
  const { t } = useTranslation();
  const { data: available, isLoading: loadingAvailable } =
    useAvailableIntegrations();
  const { data: installed, isLoading: loadingInstalled } =
    useInstalledIntegrations();
  const installMutation = useInstallIntegration();
  const uninstallMutation = useUninstallIntegration();

  const handleInstall = useCallback(
    async (type: string) => {
      const definition = available?.find((d) => d.type === type);

      // OAuth providers only become installed once the admin's OAuth
      // callback succeeds; a cancelled or failed flow persists nothing.
      if (definition?.capabilities?.includes("oauth")) {
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

      installMutation.mutate({ type });
    },
    [installMutation, available, t],
  );

  const handleUninstall = useCallback(
    (integrationId: string) => {
      const installation = installed?.find((i) => i.id === integrationId);
      const name =
        available?.find((d) => d.type === installation?.type)?.name ??
        installation?.type ??
        "";
      modals.openConfirmModal({
        title: t("Uninstall {{name}}", { name }),
        centered: true,
        children: (
          <Text size="sm">
            {t(
              "This disables the {{name}} integration for the entire workspace. Members' connections are removed and links are not enriched.",
              { name },
            )}
          </Text>
        ),
        labels: { confirm: t("Uninstall"), cancel: t("Cancel") },
        confirmProps: { color: "red" },
        onConfirm: () => uninstallMutation.mutate({ integrationId }),
      });
    },
    [uninstallMutation, installed, available, t],
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
              />
            );
          })}
        </Stack>
      )}
    </>
  );
}
