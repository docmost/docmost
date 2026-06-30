import { useEffect, useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDisconnectLinearMutation,
  useLinearStatusQuery,
} from "../queries/linear-query";
import { LINEAR_PROVIDER } from "../services/linear-service";
import { getOAuthAuthorizeUrl } from "@/features/integrations/services/oauth-integration-service";
import IntegrationCard from "@/features/integrations/components/integration-card.tsx";
import LinearAdminConfig from "./linear-admin-config.tsx";
import LinearIcon from "@/components/icons/linear-icon.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";

export default function LinearConnection() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { data: status, isLoading } = useLinearStatusQuery();
  const disconnectMutation = useDisconnectLinearMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("integration") !== LINEAR_PROVIDER) return;
    const result = searchParams.get("status");

    if (result === "connected") {
      notifications.show({ message: t("Linear connected") });
      queryClient.invalidateQueries({ queryKey: ["linear-status"] });
    } else if (result === "error") {
      notifications.show({
        message: t("Could not connect Linear. Please try again."),
        color: "red",
      });
    }

    searchParams.delete("integration");
    searchParams.delete("status");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, queryClient, t]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const { url } = await getOAuthAuthorizeUrl(LINEAR_PROVIDER);
      if (!url) {
        setIsConnecting(false);
        notifications.show({
          message: t("Linear has not been set up for this workspace yet."),
          color: "red",
        });
        return;
      }
      window.location.href = url;
    } catch {
      setIsConnecting(false);
      notifications.show({
        message: t("Could not start the Linear connection."),
        color: "red",
      });
    }
  };

  const description = status?.connected
    ? t("Connected as {{name}}", {
        name: status.accountName ?? t("your Linear account"),
      })
    : status?.configured
      ? t(
          "Connect your Linear account to mention, preview, and create issues in your pages.",
        )
      : t("Linear has not been set up for this workspace yet.");

  return (
    <>
      <IntegrationCard
        name="Linear"
        icon={<LinearIcon size={24} />}
        connected={!!status?.connected}
        loading={isLoading || isConnecting}
        disconnecting={disconnectMutation.isPending}
        onConnect={handleConnect}
        onDisconnect={() => disconnectMutation.mutate()}
        description={description}
        adminControl={
          isAdmin ? (
            <Tooltip label={t("Configure Linear")}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                aria-label={t("Configure Linear")}
                onClick={() => setConfigOpen(true)}
              >
                <IconSettings size={20} />
              </ActionIcon>
            </Tooltip>
          ) : undefined
        }
      />
      {isAdmin && (
        <LinearAdminConfig
          opened={configOpen}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </>
  );
}
