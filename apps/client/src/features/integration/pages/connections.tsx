import { useEffect, useRef } from "react";
import { Text, Alert, Stack, Button, Group, List } from "@mantine/core";
import { modals } from "@mantine/modals";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
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
import { resolveConnectPrompt } from "../utils/connect-prompt";
import type { IntegrationDefinition } from "../types/integration.types";

export default function Connections() {
  const { t } = useTranslation();
  const { data: available, isLoading: loadingAvailable } =
    useAvailableIntegrations();
  const { data: installed, isLoading: loadingInstalled } =
    useInstalledIntegrations();
  const { data: myConnections, isLoading: loadingConnections } =
    useMyConnections();
  const disconnectMutation = useDisconnectIntegration();

  const [searchParams, setSearchParams] = useSearchParams();
  const connectType = searchParams.get("connect");
  const prompted = useRef(false);
  const mounted = useRef(true);

  const isLoading = loadingAvailable || loadingInstalled || loadingConnections;

  const handleConnect = async (type: string) => {
    const integration = installed?.find((i) => i.type === type);
    if (!integration) return;

    try {
      // Workspace-scoped providers otherwise return to the admin integrations page.
      const result = await integrationService.getOAuthAuthorizeUrl({
        integrationId: integration.id,
        returnPath: "/settings/account/connections",
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

  useEffect(() => {
    if (isLoading) return;
    const definition = resolveConnectPrompt(
      connectType,
      available,
      installed,
      myConnections,
    );
    if (!definition) {
      if (connectType) {
        modals.close("connect-prompt");
        setSearchParams({}, { replace: true });
      } else {
        prompted.current = false;
      }
      return;
    }
    if (prompted.current) return;
    prompted.current = true;
    modals.open({
      modalId: "connect-prompt",
      title: t("Connect {{name}} to Docmost", { name: definition.name }),
      centered: true,
      // Mantine also calls onClose on unmount, and navigating then would bounce the user back here.
      onClose: () => {
        if (mounted.current) setSearchParams({}, { replace: true });
      },
      children: (
        <ConnectPromptBody
          definition={definition}
          onConnect={() => {
            modals.close("connect-prompt");
            handleConnect(definition.type);
          }}
          onCancel={() => modals.close("connect-prompt")}
        />
      ),
    });
  }, [connectType, available, installed, myConnections, isLoading]);

  // The modal lives on the app-root provider, so it must not outlive this page.
  useEffect(
    () => () => {
      mounted.current = false;
      modals.close("connect-prompt");
    },
    [],
  );

  const handleDisconnect = (integrationId: string) => {
    const installation = installed?.find((i) => i.id === integrationId);
    const name =
      available?.find((d) => d.type === installation?.type)?.name ??
      installation?.type ??
      "";
    modals.openConfirmModal({
      title: t("Disconnect {{name}}", { name }),
      centered: true,
      children: (
        <Text size="sm">
          {t(
            "This disconnects your {{name}} account. Links are not enriched for you until you reconnect.",
            { name },
          )}
        </Text>
      ),
      labels: { confirm: t("Disconnect"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => disconnectMutation.mutate({ integrationId }),
    });
  };

  // Only the row being disconnected shows a loader.
  const disconnectingId = disconnectMutation.isPending
    ? disconnectMutation.variables?.integrationId
    : undefined;

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

      {error === "identity_mismatch" && (
        <Alert color="red" mb="md">
          {t(
            "The account you signed in with does not use your Docmost email address. Sign in to the provider with the account that matches your Docmost email and try again.",
          )}
        </Alert>
      )}

      {error === "tenant_mismatch" && (
        <Alert color="red" mb="md">
          {t(
            "The Slack account you signed in with is not in the Slack workspace connected to Docmost. Sign in to Slack with your account in that workspace and try again.",
          )}
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
                  disconnectingId={disconnectingId}
                />
              );
            })}
        </Stack>
      )}
    </>
  );
}

type ConnectPromptBodyProps = {
  definition: IntegrationDefinition;
  onConnect: () => void;
  onCancel: () => void;
};

function ConnectPromptBody({
  definition,
  onConnect,
  onCancel,
}: ConnectPromptBodyProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="sm">
      {definition.type === "slack" ? (
        <>
          <Text size="sm">
            {t("Link your Slack account to your Docmost account to:")}
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>
              {t("Search and open Docmost pages from Slack")}
            </List.Item>
            <List.Item>
              {t("Create pages and save Slack messages to Docmost")}
            </List.Item>
            <List.Item>
              {t("Ask AI questions about your workspace docs")}
            </List.Item>
            <List.Item>
              {t("Get your Docmost notifications as Slack DMs")}
            </List.Item>
            <List.Item>
              {t(
                "See previews of Docmost links in Slack and Slack links in Docmost",
              )}
            </List.Item>
          </List>
          <Text size="sm" c="dimmed">
            {t(
              "You will sign in with Slack to confirm which Slack account is yours. It must use the same email as your Docmost account.",
            )}
          </Text>
        </>
      ) : (
        <Text size="sm">
          {t(
            "Connect your {{name}} account so links you paste show rich previews.",
            { name: definition.name },
          )}
        </Text>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button onClick={onConnect}>{t("Connect")}</Button>
      </Group>
    </Stack>
  );
}
