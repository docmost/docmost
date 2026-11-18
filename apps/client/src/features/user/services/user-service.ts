import api from "@/lib/api-client";
import {
  ICurrentUser,
  IUser,
  IUserProfile,
  IUserProfileSpace,
  IUserRecentPage,
} from "@/features/user/types/user.types";
import { IPagination, QueryParams } from "@/lib/types";

export async function getMyInfo(): Promise<ICurrentUser> {
  const req = await api.post<ICurrentUser>("/users/me");
  return req.data as ICurrentUser;
}

export async function updateUser(data: Partial<IUser>): Promise<IUser> {
  const req = await api.post<IUser>("/users/update", data);
  return req.data as IUser;
}

export async function getUserProfile(userId: string): Promise<IUserProfile> {
  const req = await api.post<IUserProfile>("/users/info", { userId });
  return req.data;
}

export async function getUserSpaces(
  params: { userId: string } & QueryParams,
): Promise<IPagination<IUserProfileSpace>> {
  const req = await api.post("/users/spaces", params);
  return req.data;
}

export async function getUserRecentPages(
  params: { userId: string } & QueryParams,
): Promise<IPagination<IUserRecentPage>> {
  const req = await api.post("/users/recent-pages", params);
  return req.data;
}

