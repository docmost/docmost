import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  getLinearIssue,
  getLinearTeams,
  searchLinearIssues,
  LINEAR_PROVIDER,
} from "../services/linear-service";
import {
  deleteOAuthAppConfig,
  disconnectOAuthIntegration,
  getOAuthAppConfig,
  getOAuthConnectionStatus,
  setOAuthAppConfig,
} from "@/features/integrations/services/oauth-integration-service";
import {
  IOAuthAppConfig,
  IOAuthConnectionStatus,
} from "@/features/integrations/types";
import {
  ILinearIssueResult,
  ILinearIssueSearchResult,
  ILinearTeamsResult,
} from "../types/linear.types";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function useLinearStatusQuery(): UseQueryResult<
  IOAuthConnectionStatus,
  Error
> {
  return useQuery({
    queryKey: ["linear-status"],
    queryFn: () => getOAuthConnectionStatus(LINEAR_PROVIDER),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLinearIssueQuery(
  issueId: string | null | undefined,
  enabled: boolean,
): UseQueryResult<ILinearIssueResult, Error> {
  return useQuery({
    queryKey: ["linear-issue", issueId],
    queryFn: () => getLinearIssue(issueId as string),
    enabled: enabled && !!issueId,
    staleTime: 60 * 1000,
  });
}

export function useLinearIssueSearchQuery(
  query: string,
): UseQueryResult<ILinearIssueSearchResult, Error> {
  return useQuery({
    queryKey: ["linear-search", query],
    queryFn: () => searchLinearIssues(query),
    enabled: query.trim().length > 0,
    staleTime: 30 * 1000,
  });
}

export function useLinearTeamsQuery(
  enabled: boolean,
): UseQueryResult<ILinearTeamsResult, Error> {
  return useQuery({
    queryKey: ["linear-teams"],
    queryFn: () => getLinearTeams(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLinearConfigQuery(
  enabled: boolean,
): UseQueryResult<IOAuthAppConfig, Error> {
  return useQuery({
    queryKey: ["linear-config"],
    queryFn: () => getOAuthAppConfig(LINEAR_PROVIDER),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetLinearConfigMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, { clientId: string; clientSecret: string }>({
    mutationFn: (input) => setOAuthAppConfig(LINEAR_PROVIDER, input),
    onSuccess: () => {
      notifications.show({ message: t("Linear configuration saved") });
      queryClient.invalidateQueries({ queryKey: ["linear-config"] });
      queryClient.invalidateQueries({ queryKey: ["linear-status"] });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to save Linear configuration"),
        color: "red",
      });
    },
  });
}

export function useDeleteLinearConfigMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error>({
    mutationFn: () => deleteOAuthAppConfig(LINEAR_PROVIDER),
    onSuccess: () => {
      notifications.show({ message: t("Linear configuration removed") });
      queryClient.invalidateQueries({ queryKey: ["linear-config"] });
      queryClient.invalidateQueries({ queryKey: ["linear-status"] });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to remove Linear configuration"),
        color: "red",
      });
    },
  });
}

export function useDisconnectLinearMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error>({
    mutationFn: () => disconnectOAuthIntegration(LINEAR_PROVIDER),
    onSuccess: () => {
      notifications.show({ message: t("Linear disconnected") });
      queryClient.invalidateQueries({ queryKey: ["linear-status"] });
      queryClient.invalidateQueries({ queryKey: ["linear-teams"] });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to disconnect Linear"),
        color: "red",
      });
    },
  });
}
