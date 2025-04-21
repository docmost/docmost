import api from "@/lib/api-client.ts";
import {
  IBilling,
  IBillingPlan,
  IBillingPortal,
  ICheckoutLink,
} from "@/ee/billing/types/billing.types.ts";

export async function getBilling(): Promise<IBilling> {
  const req = await api.post<IBilling>("/billing/info");
  return req.data;
}

export async function getBillingPlans(): Promise<IBillingPlan[]> {
  const req = await api.post<IBillingPlan[]>("/billing/plans");
  return req.data;
}

export async function getCheckoutLink(data: {
  priceId: string;
}): Promise<ICheckoutLink> {
  const req = await api.post<ICheckoutLink>("/billing/checkout", data);
  return req.data;
}

export async function getBillingPortalLink(): Promise<IBillingPortal> {
  const req = await api.post<IBillingPortal>("/billing/portal");
  return req.data;
}
