import api from "@/lib/api-client";
import {
  IChangePassword,
  ICollabToken,
  IForgotPassword,
  ILogin,
  IPasswordReset,
  ISetupWorkspace,
  IVerifyUserToken,
} from "@/features/auth/types/auth.types";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";

export async function login(data: ILogin): Promise<any> {
  const payload: any = {
    email: data.email,
    password: data.password,
  };
  
  if (data.totpToken && data.totpToken.trim() !== '') {
    payload.totpToken = data.totpToken;
  }
  
  const req = await api.post("/auth/login", payload);
  return req.data;
}

export async function logout(): Promise<void> {
  await api.post<void>("/auth/logout");
}

export async function changePassword(
  data: IChangePassword,
): Promise<IChangePassword> {
  const req = await api.post<IChangePassword>("/auth/change-password", data);
  return req.data;
}

export async function setupWorkspace(
  data: ISetupWorkspace,
): Promise<IWorkspace> {
  const req = await api.post<IWorkspace>("/auth/setup", data);
  return req.data;
}

export async function forgotPassword(data: IForgotPassword): Promise<void> {
  await api.post<void>("/auth/forgot-password", data);
}

export async function passwordReset(data: IPasswordReset): Promise<void> {
  await api.post<void>("/auth/password-reset", data);
}

export async function verifyUserToken(data: IVerifyUserToken): Promise<any> {
  return api.post<any>("/auth/verify-token", data);
}

export async function getCollabToken(): Promise<ICollabToken> {
  const req = await api.post<ICollabToken>("/auth/collab-token");
  return req.data;
}

export async function setupTotp(): Promise<{
  qrCodeDataUrl: string;
  secret: string;
}> {
  const req = await api.post("/auth/totp/setup");
  return req.data;
}

export async function enableTotp(data: {
  token: string;
  secret: string;
}): Promise<{ backupCodes: string[] }> {
  const req = await api.post("/auth/totp/enable", data);
  return req.data;
}

export async function disableTotp(data: { token: string }): Promise<void> {
  await api.post("/auth/totp/disable", data);
}

export async function verifyTotp(data: { token: string }): Promise<{ valid: boolean }> {
  const req = await api.post("/auth/totp/verify", data);
  return req.data;
}

export async function regenerateBackupCodes(): Promise<{ backupCodes: string[] }> {
  const req = await api.post("/auth/totp/regenerate-backup-codes");
  return req.data;
}
