import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { getCollabToken, verifyUserToken } from "../services/auth-service";
import { ICollabToken, IVerifyUserToken } from "../types/auth.types";
import { isAxiosError } from "axios";

const COLLAB_AUTH_MAX_RETRIES = 3;

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
      if (isAxiosError(error) && error.response?.status === 404) {
        return false;
      }
      return failureCount < COLLAB_AUTH_MAX_RETRIES;
    },
    retryDelay: (retryAttempt) => Math.min(1000 * 2 ** retryAttempt, 5000),
  });
}

export function useCollabAuthenticationRecovery({
  token,
  refetch,
}: {
  token?: string;
  refetch: () => Promise<{ data?: ICollabToken }>;
}) {
  const tokenRef = useRef(token);
  const refetchRef = useRef(refetch);
  const recoveryScheduled = useRef(false);
  const refetchInFlight = useRef(false);
  const retriesSinceAuthentication = useRef(0);
  const [recoveryRevision, setRecoveryRevision] = useState(0);
  const [isRecoveryExhausted, setIsRecoveryExhausted] = useState(false);

  tokenRef.current = token;
  refetchRef.current = refetch;

  const handleAuthenticationFailed = useCallback(() => {
    if (refetchInFlight.current || recoveryScheduled.current) {
      return;
    }

    if (retriesSinceAuthentication.current >= COLLAB_AUTH_MAX_RETRIES) {
      setIsRecoveryExhausted(true);
      return;
    }

    recoveryScheduled.current = true;
    retriesSinceAuthentication.current += 1;
    setRecoveryRevision((revision) => revision + 1);
  }, []);

  const getToken = useCallback(async () => {
    if (!recoveryScheduled.current || refetchInFlight.current) {
      return tokenRef.current || "";
    }

    recoveryScheduled.current = false;
    refetchInFlight.current = true;

    try {
      const result = await refetchRef.current();
      return result.data?.token || tokenRef.current || "";
    } finally {
      refetchInFlight.current = false;
    }
  }, [recoveryRevision]);

  const handleAuthenticated = useCallback(() => {
    recoveryScheduled.current = false;
    retriesSinceAuthentication.current = 0;
    setIsRecoveryExhausted(false);
  }, []);

  return {
    getToken,
    handleAuthenticationFailed,
    handleAuthenticated,
    isRecoveryExhausted,
  };
}
