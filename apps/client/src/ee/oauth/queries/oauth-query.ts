import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  getOAuthGrants,
  revokeOAuthGrant,
} from "@/ee/oauth/services/oauth-service";
import { IOAuthGrant } from "@/ee/oauth/types/oauth.types";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function useOAuthGrantsQuery(): UseQueryResult<IOAuthGrant[], Error> {
  return useQuery({
    queryKey: ["oauth-grants"],
    queryFn: () => getOAuthGrants(),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useRevokeOAuthGrantMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (grantId) => revokeOAuthGrant(grantId),
    onSuccess: () => {
      notifications.show({ message: t("Access revoked") });
      queryClient.invalidateQueries({
        predicate: (item) =>
          ["oauth-grants"].includes(item.queryKey[0] as string),
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Something went wrong. Please try again."),
        color: "red",
      });
    },
  });
}
