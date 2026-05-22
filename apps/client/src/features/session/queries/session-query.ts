import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  getSessions,
  revokeSession,
  revokeAllSessions,
} from "@/features/session/services/session-service";
import { ISession } from "@/features/session/types/session.types";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function useGetSessionsQuery(): UseQueryResult<ISession[], Error> {
  return useQuery({
    queryKey: ["session-list"],
    queryFn: () => getSessions(),
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, { sessionId: string }>({
    mutationFn: (data) => revokeSession(data),
    onSuccess: () => {
      notifications.show({ message: t("Session revoked") });
      queryClient.invalidateQueries({ queryKey: ["session-list"] });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useRevokeAllSessionsMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, void>({
    mutationFn: () => revokeAllSessions(),
    onSuccess: () => {
      notifications.show({ message: t("All other sessions revoked") });
      queryClient.invalidateQueries({ queryKey: ["session-list"] });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}
