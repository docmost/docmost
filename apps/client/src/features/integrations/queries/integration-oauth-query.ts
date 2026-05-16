import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  disconnectIntegration,
  listIntegrations,
} from "@/features/integrations/services/integration-oauth-service";
import { IntegrationListItem } from "@/features/integrations/types/integration.types";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const INTEGRATIONS_QUERY_KEY = ["integration-oauth-list"];

export function useGetIntegrationsQuery(): UseQueryResult<
  IntegrationListItem[],
  Error
> {
  return useQuery({
    queryKey: INTEGRATIONS_QUERY_KEY,
    queryFn: () => listIntegrations(),
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
