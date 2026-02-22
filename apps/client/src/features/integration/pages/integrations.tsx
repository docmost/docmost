import { SimpleGrid, Text, Loader, Center, Alert } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useState, useCallback } from "react";
import { getAppName } from "@/lib/config";
import SettingsTitle from "@/components/settings/settings-title";
import IntegrationCard from "../components/integration-card";
import IntegrationSettingsModal from "../components/integration-settings-modal";
import {
  useAvailableIntegrations,
  useInstalledIntegrations,
  useInstallIntegration,
  useUninstallIntegration,
  useUpdateIntegrationSettings,
} from "../queries/integration-query";
import { Integration } from "../types/integration.types";

export default function Integrations() {
  const { t } = useTranslation();
  const { data: available, isLoading: loadingAvailable } =
    useAvailableIntegrations();
  const { data: installed, isLoading: loadingInstalled } =
    useInstalledIntegrations();
  const installMutation = useInstallIntegration();
  const uninstallMutation = useUninstallIntegration();
  const updateMutation = useUpdateIntegrationSettings();

  const [configuring, setConfiguring] = useState<Integration | null>(null);

  const handleInstall = useCallback(
    (type: string) => {
      installMutation.mutate({ type });
    },
    [installMutation],
  );

  const handleUninstall = useCallback(
    (integrationId: string) => {
      uninstallMutation.mutate({ integrationId });
    },
    [uninstallMutation],
  );

  const handleConfigure = useCallback((integration: Integration) => {
    setConfiguring(integration);
  }, []);

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

      {error === "oauth_failed" && (
        <Alert color="red" mb="md">
          {t("OAuth connection failed. Please try again.")}
        </Alert>
      )}

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : !available?.length ? (
        <Text c="dimmed" size="sm">
          {t("No integrations available.")}
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {available.map((def) => {
            const installation = installed?.find((i) => i.type === def.type);
            return (
              <IntegrationCard
                key={def.type}
                definition={def}
                installation={installation}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onConfigure={handleConfigure}
                onToggle={handleToggle}
              />
            );
          })}
        </SimpleGrid>
      )}

      <IntegrationSettingsModal
        integration={configuring}
        opened={!!configuring}
        onClose={() => setConfiguring(null)}
      />
    </>
  );
}
