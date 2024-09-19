import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { verifyUserToken } from "../services/auth-service";
import { IVerifyUserToken } from "../types/auth.types";

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