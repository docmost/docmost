import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getEntitlements } from "./entitlement-service";
import { Entitlements } from "./entitlement.types";

export function useEntitlements(enabled = true): UseQueryResult<Entitlements> {
  return useQuery({
    queryKey: ["entitlements"],
    queryFn: getEntitlements,
    enabled,
    retryOnMount: false,
    staleTime: 5 * 60 * 1000,
  });
}
