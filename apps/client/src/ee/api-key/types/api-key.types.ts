import { IUser } from "@/features/user/types/user.types.ts";

export interface IApiKey {
  id: string;
  name: string;
  token?: string;
  creatorId: string;
  workspaceId: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  creator: Partial<IUser>;
}

export interface ICreateApiKeyRequest {
  name: string;
  expiresAt?: string;
}

export interface IUpdateApiKeyRequest {
  apiKeyId: string;
  name: string;
}
