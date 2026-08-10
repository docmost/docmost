import { Text, Alert, Stack } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { getAppName } from "@/lib/config";
import SettingsTitle from "@/components/settings/settings-title";
import ConnectionRow from "../components/connection-row";
import IntegrationListSkeleton from "../components/integration-list-skeleton";
import {
  useAvailableIntegrations,
  useInstalledIntegrations,
  useMyConnections,
  useDisconnectIntegration,
} from "../queries/integration-query";
import * as integrationService from "../services/integration-service";

export default function Connections() {
  const { t } = useTranslation();
  const { data: available, isLoading: loadingAvailable } =
    useAvailableIntegrations();
  const { data: installed, isLoading: loadingInstalled } =
    useInstalledIntegrations();
  const { data: myConnections, isLoading: loadingConnections } =
    useMyConnections();
  const disconnectMutation = useDisconnectIntegration();

  const isLoading = loadingAvailable || loadingInstalled || loadingConnections;

  const handleConnect = async (type: string) => {
    const integration = installed?.find((i) => i.type === type);
    if (!integration) return;

    try {
      const result = await integrationService.getOAuthAuthorizeUrl({
        integrationId: integration.id,
      });
      window.location.href = result.authorizationUrl;
    } catch (error) {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to start OAuth connection"),
        color: "red",
      });
    }
  };

  const handleDisconnect = (integrationId: string) => {
    disconnectMutation.mutate({ integrationId });
  };

  const error = new URLSearchParams(window.location.search).get("error");

  return (
    <>
      <Helmet>
        <title>
          {t("Connections")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("Connections")} />

      <Text size="sm" c="dimmed" mb="md">
        {t("Manage the apps you have connected to your account.")}
      </Text>

      {error === "oauth_failed" && (
        <Alert color="red" mb="md">
          {t("OAuth connection failed. Please try again.")}
        </Alert>
      )}

      {isLoading ? (
        <IntegrationListSkeleton rows={3} withBadges={false} />
      ) : !available?.length ? (
        <Text c="dimmed" size="sm">
          {t("No integrations available.")}
        </Text>
      ) : (
        <Stack gap={0}>
          {available
            .filter((def) => {
              if (!def.capabilities.includes("oauth")) return false;
              return installed?.some((i) => i.type === def.type);
            })
            .map((def) => {
              const connection = myConnections?.find(
                (c) => c.type === def.type,
              );

              return (
                <ConnectionRow
                  key={def.type}
                  definition={def}
                  connection={connection}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  isDisconnecting={disconnectMutation.isPending}
                />
              );
            })}
        </Stack>
      )}
    </>
  );
}
