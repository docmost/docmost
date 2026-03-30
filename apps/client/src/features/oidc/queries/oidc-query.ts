import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  createOidcProvider,
  disableOidcProvider,
  enableOidcProvider,
  getOidcProviders,
  updateOidcProvider,
} from "@/features/oidc/services/oidc-service.ts";
import {
  ICreateOidcProvider,
  IOidcProvider,
  IUpdateOidcProvider,
} from "@/features/oidc/types/oidc.types.ts";

export function useOidcProvidersQuery() {
  return useQuery({
    queryKey: ["oidcProviders"],
    queryFn: getOidcProviders,
  });
}

export function useCreateOidcProviderMutation() {
  const queryClient = useQueryClient();

  return useMutation<IOidcProvider, Error, ICreateOidcProvider>({
    mutationFn: createOidcProvider,
    onSuccess: () => {
      notifications.show({ message: "OIDC provider created" });
      queryClient.invalidateQueries({ queryKey: ["oidcProviders"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-public"] });
    },
    onError: (error) => {
      notifications.show({
        message: error["response"]?.data?.message ?? "Failed to create OIDC provider",
        color: "red",
      });
    },
  });
}

export function useUpdateOidcProviderMutation(providerId: string) {
  const queryClient = useQueryClient();

  return useMutation<IOidcProvider, Error, IUpdateOidcProvider>({
    mutationFn: (data) => updateOidcProvider(providerId, data),
    onSuccess: () => {
      notifications.show({ message: "OIDC provider updated" });
      queryClient.invalidateQueries({ queryKey: ["oidcProviders"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-public"] });
    },
    onError: (error) => {
      notifications.show({
        message: error["response"]?.data?.message ?? "Failed to update OIDC provider",
        color: "red",
      });
    },
  });
}

export function useEnableOidcProviderMutation(providerId: string) {
  const queryClient = useQueryClient();

  return useMutation<IOidcProvider, Error, void>({
    mutationFn: () => enableOidcProvider(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oidcProviders"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-public"] });
    },
    onError: (error) => {
      notifications.show({
        message: error["response"]?.data?.message ?? "Failed to enable OIDC provider",
        color: "red",
      });
    },
  });
}

export function useDisableOidcProviderMutation(providerId: string) {
  const queryClient = useQueryClient();

  return useMutation<IOidcProvider, Error, void>({
    mutationFn: () => disableOidcProvider(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oidcProviders"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-public"] });
    },
    onError: (error) => {
      notifications.show({
        message: error["response"]?.data?.message ?? "Failed to disable OIDC provider",
        color: "red",
      });
    },
  });
}
