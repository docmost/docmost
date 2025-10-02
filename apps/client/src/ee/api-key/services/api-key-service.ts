import api from "@/lib/api-client";
import {
  ICreateApiKeyRequest,
  IApiKey,
  IUpdateApiKeyRequest,
} from "@/ee/api-key/types/api-key.types";
import { IPagination, QueryParams } from "@/lib/types.ts";

export async function getApiKeys(
  params?: QueryParams,
): Promise<IPagination<IApiKey>> {
  const req = await api.post("/api-keys", { ...params });
  return req.data;
}

export async function createApiKey(
  data: ICreateApiKeyRequest,
): Promise<IApiKey> {
  const req = await api.post<IApiKey>("/api-keys/create", data);
  return req.data;
}

export async function updateApiKey(
  data: IUpdateApiKeyRequest,
): Promise<IApiKey> {
  const req = await api.post<IApiKey>("/api-keys/update", data);
  return req.data;
}

export async function revokeApiKey(data: { apiKeyId: string }): Promise<void> {
  await api.post("/api-keys/revoke", data);
}
