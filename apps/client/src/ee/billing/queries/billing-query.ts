import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getBilling } from "@/ee/billing/services/billing-service.ts";
import { IBilling } from "@/ee/billing/types/billing.types.ts";

export function useBillingQuery(): UseQueryResult<IBilling, Error> {
  return useQuery({
    queryKey: ["billing"],
    queryFn: () => getBilling(),
  });
}
