import api from "@/lib/api-client.ts";
import { ILoginResponse } from "@/features/auth/types/auth.types.ts";

interface ILdapLogin {
  username: string;
  password: string;
  providerId: string;
  workspaceId: string;
}

export async function ldapLogin(data: ILdapLogin): Promise<ILoginResponse> {
  const requestData = {
    username: data.username,
    password: data.password,
  };

  const response = await api.post<ILoginResponse>(
    `/sso/ldap/${data.providerId}/login`,
    requestData
  );

  return response.data;
}
