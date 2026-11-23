import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getCollabToken, verifyUserToken } from "../services/auth-service";
import { ICollabToken, IVerifyUserToken } from "../types/auth.types";
import { isAxiosError } from "axios";
import { jwtDecode } from "jwt-decode";
import type { IUser } from "@/features/user/types/user.types";

export function useVerifyUserTokenQuery(
  verify: IVerifyUserToken,
): UseQueryResult<any, Error> {
  return useQuery({
    queryKey: ["verify-token", verify],
    queryFn: () => verifyUserToken(verify),
    enabled: !!verify.token,
    staleTime: 0,
  });
}

export function useCollabToken(
  user?: Pick<IUser, "id" | "workspaceId">,
): UseQueryResult<ICollabToken, Error> {
  return useQuery({
    queryKey: ["collab-token", user?.workspaceId, user?.id],
    enabled: Boolean(user?.workspaceId && user?.id),
    queryFn: async () => {
      const response = await getCollabToken();
      const claims = jwtDecode<{ sub: string; workspaceId: string }>(
        response.token,
      );
      if (claims.sub !== user.id || claims.workspaceId !== user.workspaceId) {
        throw new Error("Collaboration session changed");
      }
      return response;
    },
    staleTime: 20 * 60 * 60 * 1000, //20hrs
    //refetchInterval: 12 * 60 * 60 * 1000, // 12hrs
    //refetchIntervalInBackground: true,
    refetchOnMount: true,
    retry: (failureCount, error) => {
      if (isAxiosError(error) && error.response?.status === 404) {
        return false;
      }
      return failureCount < 10;
    },
    retryDelay: (retryAttempt) => {
      // Exponential backoff: 5s, 10s, 20s, etc.
      return 5000 * Math.pow(2, retryAttempt - 1);
    },
  });
}
