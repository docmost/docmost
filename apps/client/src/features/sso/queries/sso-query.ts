import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  commitWizard,
  createGroupMapping,
  deleteGroupMapping,
  getGroupMappings,
  getSsoConfig,
  resyncGroups,
  updateSsoConfig,
} from "@/features/sso/services/sso-service.ts";
import {
  IGoogleSsoConfig,
  IGroupMapping,
} from "@/features/sso/types/sso.types.ts";

export function useSsoConfigQuery(): UseQueryResult<IGoogleSsoConfig, Error> {
  return useQuery({
    queryKey: ["sso-config"],
    queryFn: () => getSsoConfig(),
  });
}

export function useGroupMappingsQuery(): UseQueryResult<
  IGroupMapping[],
  Error
> {
  return useQuery({
    queryKey: ["sso-group-mappings"],
    queryFn: () => getGroupMappings(),
  });
}

export function useUpdateSsoConfigMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<IGoogleSsoConfig>) => updateSsoConfig(data),
    onSuccess: () => {
      notifications.show({ message: t("Settings updated") });
      queryClient.invalidateQueries({ queryKey: ["sso-config"] });
    },
    onError: (error) => {
      notifications.show({
        message: error?.["response"]?.data?.message || t("Failed to update"),
        color: "red",
      });
    },
  });
}

export function useCreateGroupMappingMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      externalGroupKey: string;
      groupId: string;
      role?: string;
    }) => createGroupMapping(data),
    onSuccess: () => {
      notifications.show({ message: t("Mapping created") });
      queryClient.invalidateQueries({ queryKey: ["sso-group-mappings"] });
    },
    onError: (error) => {
      notifications.show({
        message:
          error?.["response"]?.data?.message || t("Failed to create mapping"),
        color: "red",
      });
    },
  });
}

export function useDeleteGroupMappingMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { mappingId: string }) => deleteGroupMapping(data),
    onSuccess: () => {
      notifications.show({ message: t("Mapping removed") });
      queryClient.invalidateQueries({ queryKey: ["sso-group-mappings"] });
    },
    onError: (error) => {
      notifications.show({
        message:
          error?.["response"]?.data?.message || t("Failed to remove mapping"),
        color: "red",
      });
    },
  });
}

export function useResyncGroupsMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { mappingId?: string }) => resyncGroups(data),
    onSuccess: () => {
      notifications.show({
        message: t("Resync started. This may take a moment."),
      });
      queryClient.invalidateQueries({ queryKey: ["sso-group-mappings"] });
    },
    onError: (error) => {
      notifications.show({
        message:
          error?.["response"]?.data?.message || t("Failed to start resync"),
        color: "red",
      });
    },
  });
}

export function useCommitWizardMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: commitWizard,
    onSuccess: () => {
      notifications.show({ message: t("Group mappings saved") });
      queryClient.invalidateQueries({ queryKey: ["sso-group-mappings"] });
    },
    onError: (error) => {
      notifications.show({
        message:
          error?.["response"]?.data?.message || t("Failed to save mappings"),
        color: "red",
      });
    },
  });
}
