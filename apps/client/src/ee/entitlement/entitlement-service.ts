import api from "@/lib/api-client";
import { Entitlements } from "./entitlement.types";

export async function getEntitlements(): Promise<Entitlements> {
  const req = await api.post<Entitlements>("/workspace/entitlements");
  return req.data as Entitlements;
}
