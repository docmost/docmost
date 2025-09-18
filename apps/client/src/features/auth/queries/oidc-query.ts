import { useQuery, useMutation, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { 
  getOidcConfig, 
  getOidcProvider, 
  createOidcProvider, 
  updateOidcProvider, 
  deleteOidcProvider,
  IOidcConfig,
  IOidcProvider,
  ICreateOidcProvider,
  IUpdateOidcProvider
} from "@/features/auth/services/oidc-service";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function useOidcConfigQuery(): UseQueryResult<IOidcConfig, Error> {
  return useQuery({
    queryKey: ["oidc-config"],
    queryFn: () => getOidcConfig(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOidcProviderQuery(): UseQueryResult<IOidcProvider, Error> {
  return useQuery({
    queryKey: ["oidc-provider"],
    queryFn: () => getOidcProvider(),
    retry: false,
  });
}

export function useCreateOidcProviderMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ICreateOidcProvider) => createOidcProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oidc-provider"] });
      notifications.show({
        message: t("OIDC provider created successfully"),
        color: "green",
      });
    },
    onError: (error: any) => {
      notifications.show({
        message: error.response?.data?.message || t("Failed to create OIDC provider"),
        color: "red",
      });
    },
  });
}

export function useUpdateOidcProviderMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: IUpdateOidcProvider }) => 
      updateOidcProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oidc-provider"] });
      notifications.show({
        message: t("OIDC provider updated successfully"),
        color: "green",
      });
    },
    onError: (error: any) => {
      notifications.show({
        message: error.response?.data?.message || t("Failed to update OIDC provider"),
        color: "red",
      });
    },
  });
}

export function useDeleteOidcProviderMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteOidcProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oidc-provider"] });
      notifications.show({
        message: t("OIDC provider deleted successfully"),
        color: "green",
      });
    },
    onError: (error: any) => {
      notifications.show({
        message: error.response?.data?.message || t("Failed to delete OIDC provider"),
        color: "red",
      });
    },
  });
}
