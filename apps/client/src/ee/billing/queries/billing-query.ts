import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  getBilling,
  getBillingPlans,
} from "@/ee/billing/services/billing-service.ts";
import { IBilling, IBillingPlan } from "@/ee/billing/types/billing.types.ts";

export function useBillingQuery(): UseQueryResult<IBilling, Error> {
  return useQuery({
    queryKey: ["billing"],
    queryFn: () => getBilling(),
  });
}

export function useBillingPlans(): UseQueryResult<IBillingPlan[], Error> {
  return useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => getBillingPlans(),
  });
}
