import api from "@/lib/api-client.ts";
import { ILoginResponse } from "@/features/auth/types/auth.types.ts";

interface ILdapLogin {
  email: string;
  password: string;
  providerId: string;
  workspaceId: string;
}

export async function ldapLogin(data: ILdapLogin): Promise<ILoginResponse> {
  // Format the request to match server expectations
  const requestData = {
    username: data.email, // Server expects username but we use email
    password: data.password,
  };

  const response = await api.post<ILoginResponse>(
    `/sso/ldap/${data.providerId}/login`,
    requestData
  );
  
  return response.data;
}