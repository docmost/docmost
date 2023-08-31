import api from "@/lib/api-client";
import { ILogin, IRegister, ITokenResponse } from "@/features/auth/types/auth.types";

export async function login(data: ILogin): Promise<ITokenResponse>{
  const req = await api.post<ITokenResponse>("/auth/login", data);
  return req.data as ITokenResponse;
}

export async function register(data: IRegister): Promise<ITokenResponse>{
  const req = await api.post<ITokenResponse>("/auth/register", data);
  return req.data as ITokenResponse;
}
