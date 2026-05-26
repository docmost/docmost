import api from "@/lib/api-client";
import type {
  CreateServicePayload,
  ListServicesParams,
  Service,
  ServiceListResponse,
  UpdateServicePayload,
} from "../types/service.types";

export async function listServices(
  params?: ListServicesParams,
): Promise<ServiceListResponse> {
  const req = await api.get("/docops/services", { params });
  return req.data;
}

export async function getService(code: string): Promise<Service> {
  const req = await api.get(`/docops/services/${code}`);
  return req.data;
}

export async function createService(
  payload: CreateServicePayload,
): Promise<Service> {
  const req = await api.post("/docops/services", payload);
  return req.data;
}

export async function updateService(
  id: string,
  payload: UpdateServicePayload,
): Promise<Service> {
  const req = await api.patch(`/docops/services/${id}`, payload);
  return req.data;
}

export async function listTags(): Promise<{ id: string; name: string }[]> {
  const req = await api.get("/docops/services/tags");
  return req.data;
}
