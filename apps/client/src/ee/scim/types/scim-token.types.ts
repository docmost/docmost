import { IUser } from "@/features/user/types/user.types.ts";

export interface IScimToken {
  id: string;
  name: string;
  token?: string;
  tokenLastFour: string;
  isEnabled: boolean;
  creatorId: string;
  workspaceId: string;
  lastUsedAt: string | null;
  createdAt: string;
  creator?: Partial<IUser>;
}

export interface ICreateScimTokenRequest {
  name: string;
}

export interface IRevokeScimTokenRequest {
  tokenId: string;
}
