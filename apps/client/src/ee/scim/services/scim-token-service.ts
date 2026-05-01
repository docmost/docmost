import api from "@/lib/api-client";
import {
  IScimToken,
  ICreateScimTokenRequest,
  IRevokeScimTokenRequest,
  IUpdateScimTokenRequest,
} from "@/ee/scim/types/scim-token.types";
import { IPagination, QueryParams } from "@/lib/types.ts";

export async function getScimTokens(
  params?: QueryParams,
): Promise<IPagination<IScimToken>> {
  const req = await api.post("/scim-tokens", { ...params });
  return req.data;
}

export async function createScimToken(
  data: ICreateScimTokenRequest,
): Promise<IScimToken> {
  const req = await api.post<IScimToken>("/scim-tokens/create", data);
  return req.data;
}

export async function updateScimToken(
  data: IUpdateScimTokenRequest,
): Promise<void> {
  await api.post("/scim-tokens/update", data);
}

export async function revokeScimToken(
  data: IRevokeScimTokenRequest,
): Promise<void> {
  await api.post("/scim-tokens/revoke", data);
}
