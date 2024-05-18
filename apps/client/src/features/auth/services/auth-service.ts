import api from "@/lib/api-client";
import {
  IChangePassword,
  ILogin,
  IRegister,
  ISetupWorkspace,
  ITokenResponse,
} from "@/features/auth/types/auth.types";

export async function login(data: ILogin): Promise<ITokenResponse> {
  const req = await api.post<ITokenResponse>("/auth/login", data);
  return req.data;
}

export async function register(data: IRegister): Promise<ITokenResponse> {
  const req = await api.post<ITokenResponse>("/auth/register", data);
  return req.data;
}

export async function changePassword(
  data: IChangePassword,
): Promise<IChangePassword> {
  const req = await api.post<IChangePassword>("/auth/change-password", data);
  return req.data;
}

export async function setupWorkspace(
  data: ISetupWorkspace,
): Promise<ITokenResponse> {
  const req = await api.post<ITokenResponse>("/auth/setup", data);
  return req.data;
}
