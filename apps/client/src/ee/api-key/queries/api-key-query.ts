import { IPagination, QueryParams } from "@/lib/types.ts";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  createApiKey,
  getApiKeys,
  IApiKey,
  ICreateApiKeyRequest,
  IUpdateApiKeyRequest,
  revokeApiKey,
  updateApiKey,
} from "@/ee/api-key";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function useGetApiKeysQuery(
  params?: QueryParams,
): UseQueryResult<IPagination<IApiKey>, Error> {
  return useQuery({
    queryKey: ["api-key-list", params],
    queryFn: () => getApiKeys(params),
    staleTime: 0,
    gcTime: 0,
    placeholderData: keepPreviousData,
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    void,
    Error,
    {
      apiKeyId: string;
    }
  >({
    mutationFn: (data) => revokeApiKey(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: t("Revoked successfully") });
      queryClient.invalidateQueries({
        predicate: (item) =>
          ["api-key-list"].includes(item.queryKey[0] as string),
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IApiKey, Error, ICreateApiKeyRequest>({
    mutationFn: (data) => createApiKey(data),
    onSuccess: () => {
      notifications.show({ message: t("API key created successfully") });
      queryClient.invalidateQueries({
        predicate: (item) =>
          ["api-key-list"].includes(item.queryKey[0] as string),
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useUpdateApiKeyMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IApiKey, Error, IUpdateApiKeyRequest>({
    mutationFn: (data) => updateApiKey(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: t("Updated successfully") });
      queryClient.invalidateQueries({
        predicate: (item) =>
          ["api-key-list"].includes(item.queryKey[0] as string),
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}
