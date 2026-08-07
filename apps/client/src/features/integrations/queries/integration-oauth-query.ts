import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  disconnectIntegration,
  listIntegrationConnections,
  listIntegrations,
  saveIntegrationConnection,
} from "@/features/integrations/services/integration-oauth-service";
import {
  IntegrationListItem,
  IntegrationOAuthConnection,
  SaveIntegrationOAuthConnectionInput,
} from "@/features/integrations/types/integration.types";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const INTEGRATIONS_QUERY_KEY = ["integration-oauth-list"];
const INTEGRATION_CONNECTIONS_QUERY_KEY = [
  "integration-oauth-admin-connections",
];

export function useGetIntegrationsQuery(): UseQueryResult<
  IntegrationListItem[],
  Error
> {
  return useQuery({
    queryKey: INTEGRATIONS_QUERY_KEY,
    queryFn: () => listIntegrations(),
  });
}

export function useGetIntegrationConnectionsQuery(): UseQueryResult<
  IntegrationOAuthConnection[],
  Error
> {
  return useQuery({
    queryKey: INTEGRATION_CONNECTIONS_QUERY_KEY,
    queryFn: () => listIntegrationConnections(),
  });
}

export function useSaveIntegrationConnectionMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    IntegrationOAuthConnection,
    Error,
    { integrationId: string; input: SaveIntegrationOAuthConnectionInput }
  >({
    mutationFn: ({ integrationId, input }) =>
      saveIntegrationConnection(integrationId, input),
    onSuccess: () => {
      notifications.show({ message: t("Integration configuration saved") });
      queryClient.invalidateQueries({
        queryKey: INTEGRATION_CONNECTIONS_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEY });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useDisconnectIntegrationMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, { integrationId: string }>({
    mutationFn: ({ integrationId }) => disconnectIntegration(integrationId),
    onSuccess: () => {
      notifications.show({ message: t("Integration disconnected") });
      queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEY });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}
