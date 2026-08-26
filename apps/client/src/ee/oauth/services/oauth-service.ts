import api from "@/lib/api-client";
import {
  IApproveAuthorizationPayload,
  IAuthorizeParams,
  IOAuthAuthorizeInfo,
  IOAuthGrant,
} from "@/ee/oauth/types/oauth.types";

export async function getOAuthAuthorizeInfo(
  params: IAuthorizeParams,
): Promise<IOAuthAuthorizeInfo> {
  const req = await api.post<IOAuthAuthorizeInfo>(
    "/oauth/authorize-info",
    params,
  );
  return req.data;
}

export async function approveOAuthAuthorization(
  payload: IApproveAuthorizationPayload,
): Promise<{ redirectUrl: string }> {
  const req = await api.post<{ redirectUrl: string }>(
    "/oauth/authorize",
    payload,
  );
  return req.data;
}

export async function getOAuthGrants(): Promise<IOAuthGrant[]> {
  const req = await api.post<IOAuthGrant[]>("/oauth/grants", {});
  return req.data;
}

export async function revokeOAuthGrant(grantId: string): Promise<void> {
  await api.post("/oauth/grants/revoke", { grantId });
}
