import api from "@/lib/api-client";
import type { CrListResponse, CrStatus } from "../types/service.types";

export interface ListCrParams {
  serviceId?: string;
  status?: CrStatus;
  limit?: number;
  offset?: number;
}

export async function listChangeRequests(
  params: ListCrParams,
): Promise<CrListResponse> {
  const req = await api.post("/docops/change-requests", params);
  return req.data;
}
