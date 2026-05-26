import api from "@/lib/api-client";
import type {
  AddExternalRefPayload,
  AvailableTransition,
  ChangeRequest,
  CrListResponse,
  CreateCrPayload,
  ListCrParams,
  TransitionCrPayload,
} from "../types/cr.types";

export async function listChangeRequests(
  params: ListCrParams,
): Promise<CrListResponse> {
  const req = await api.post("/docops/change-requests", params);
  return req.data;
}

export async function getChangeRequest(id: string): Promise<ChangeRequest> {
  const req = await api.post("/docops/change-requests/info", { id });
  return req.data;
}

export async function createChangeRequest(
  payload: CreateCrPayload,
): Promise<ChangeRequest> {
  const req = await api.post("/docops/change-requests/create", payload);
  return req.data;
}

export async function transitionChangeRequest(
  payload: TransitionCrPayload,
): Promise<ChangeRequest> {
  const req = await api.post("/docops/change-requests/transition", payload);
  return req.data;
}

export async function addExternalRef(
  payload: AddExternalRefPayload,
): Promise<void> {
  await api.post("/docops/change-requests/external-refs/add", payload);
}

export async function removeExternalRef(id: string): Promise<void> {
  await api.post("/docops/change-requests/external-refs/remove", { id });
}

export async function getAvailableTransitions(
  id: string,
): Promise<{ actions: AvailableTransition[] }> {
  const req = await api.post("/docops/change-requests/available-transitions", { id });
  return req.data;
}
