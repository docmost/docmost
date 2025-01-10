import api from "@/lib/api-client.ts";
import {
  IBilling,
  IBillingPortal,
  ICheckoutLink,
} from "@/ee/billing/types/billing.types.ts";

export async function getBilling(): Promise<IBilling> {
  const req = await api.post<IBilling>("/billing/info");
  return req.data;
}

export async function getCheckoutLink(): Promise<ICheckoutLink> {
  //TODO: this needs quantity?
  // need planId or stripe priceId
  // needs quantity
  const req = await api.post<ICheckoutLink>("/billing/checkout", "params");
  return req.data;
}

export async function getBillingPortalLink() {
  const req = await api.post<IBillingPortal>("/billing/portal");
  return req.data;
}
