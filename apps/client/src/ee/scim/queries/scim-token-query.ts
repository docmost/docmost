import { IPagination, QueryParams } from "@/lib/types.ts";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  createScimToken,
  getScimTokens,
  revokeScimToken,
} from "@/ee/scim/services/scim-token-service";
import {
  IScimToken,
  ICreateScimTokenRequest,
  IRevokeScimTokenRequest,
} from "@/ee/scim/types/scim-token.types";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function useGetScimTokensQuery(
  params?: QueryParams,
): UseQueryResult<IPagination<IScimToken>, Error> {
  return useQuery({
    queryKey: ["scim-token-list", params],
    queryFn: () => getScimTokens(params),
    staleTime: 0,
    gcTime: 0,
    placeholderData: keepPreviousData,
  });
}

export function useCreateScimTokenMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IScimToken, Error, ICreateScimTokenRequest>({
    mutationFn: (data) => createScimToken(data),
    onSuccess: () => {
      notifications.show({
        message: t("{{credential}} created successfully", {
          credential: t("SCIM token"),
        }),
      });
      queryClient.invalidateQueries({
        predicate: (item) =>
          ["scim-token-list"].includes(item.queryKey[0] as string),
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useRevokeScimTokenMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, IRevokeScimTokenRequest>({
    mutationFn: (data) => revokeScimToken(data),
    onSuccess: () => {
      notifications.show({ message: t("Revoked successfully") });
      queryClient.invalidateQueries({
        predicate: (item) =>
          ["scim-token-list"].includes(item.queryKey[0] as string),
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}
