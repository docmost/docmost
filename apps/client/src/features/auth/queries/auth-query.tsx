import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  getAuthMode,
  getCollabToken,
  verifyUserToken,
} from "../services/auth-service";
import {
  IAuthMode,
  ICollabToken,
  IVerifyUserToken,
} from "../types/auth.types";
import { isAxiosError } from "axios";

export function useAuthModeQuery(): UseQueryResult<IAuthMode, Error> {
  return useQuery({
    queryKey: ["auth-mode"],
    queryFn: getAuthMode,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

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

export function useCollabToken(): UseQueryResult<ICollabToken, Error> {
  return useQuery({
    queryKey: ["collab-token"],
    queryFn: () => getCollabToken(),
    staleTime: 20 * 60 * 60 * 1000, //20hrs
    //refetchInterval: 12 * 60 * 60 * 1000, // 12hrs
    //refetchIntervalInBackground: true,
    refetchOnMount: true,
    //@ts-ignore
    retry: (failureCount, error) => {
      if (isAxiosError(error) && error.response.status === 404) {
        return false;
      }
      return 10;
    },
    retryDelay: (retryAttempt) => {
      // Exponential backoff: 5s, 10s, 20s, etc.
      return 5000 * Math.pow(2, retryAttempt - 1);
    },
  });
}
