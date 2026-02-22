import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import * as integrationService from "../services/integration-service";

export function useAvailableIntegrations() {
  return useQuery({
    queryKey: ["available-integrations"],
    queryFn: integrationService.getAvailableIntegrations,
  });
}

export function useInstalledIntegrations() {
  return useQuery({
    queryKey: ["installed-integrations"],
    queryFn: integrationService.getInstalledIntegrations,
  });
}

export function useInstallIntegration() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: integrationService.installIntegration,
    onSuccess: () => {
      notifications.show({ message: t("Integration installed successfully") });
      qc.invalidateQueries({ queryKey: ["installed-integrations"] });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to install integration"),
        color: "red",
      });
    },
  });
}

export function useUninstallIntegration() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: integrationService.uninstallIntegration,
    onSuccess: () => {
      notifications.show({
        message: t("Integration uninstalled successfully"),
      });
      qc.invalidateQueries({ queryKey: ["installed-integrations"] });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to uninstall integration"),
        color: "red",
      });
    },
  });
}

export function useUpdateIntegrationSettings() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: integrationService.updateIntegrationSettings,
    onSuccess: () => {
      notifications.show({ message: t("Integration updated successfully") });
      qc.invalidateQueries({ queryKey: ["installed-integrations"] });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to update integration"),
        color: "red",
      });
    },
  });
}

export function useConnectionStatus(integrationId: string | undefined) {
  return useQuery({
    queryKey: ["integration-connection", integrationId],
    queryFn: () =>
      integrationService.getConnectionStatus({
        integrationId: integrationId!,
      }),
    enabled: !!integrationId,
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: integrationService.disconnectIntegration,
    onSuccess: (_data, variables) => {
      notifications.show({ message: t("Integration disconnected") });
      qc.invalidateQueries({
        queryKey: ["integration-connection", variables.integrationId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to disconnect integration"),
        color: "red",
      });
    },
  });
}
