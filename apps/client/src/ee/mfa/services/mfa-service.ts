import api from "@/lib/api-client";
import {
  MfaBackupCodesResponse,
  MfaDisableRequest,
  MfaEnableRequest,
  MfaEnableResponse,
  MfaSetupRequest,
  MfaSetupResponse,
  MfaStatusResponse,
  MfaAccessValidationResponse,
} from "@/ee/mfa";

export async function getMfaStatus(): Promise<MfaStatusResponse> {
  const req = await api.post("/mfa/status");
  return req.data;
}

export async function setupMfa(
  data: MfaSetupRequest,
): Promise<MfaSetupResponse> {
  const req = await api.post<MfaSetupResponse>("/mfa/setup", data);
  return req.data;
}

export async function enableMfa(
  data: MfaEnableRequest,
): Promise<MfaEnableResponse> {
  const req = await api.post<MfaEnableResponse>("/mfa/enable", data);
  return req.data;
}

export async function disableMfa(
  data: MfaDisableRequest,
): Promise<{ success: boolean }> {
  const req = await api.post<{ success: boolean }>("/mfa/disable", data);
  return req.data;
}

export async function regenerateBackupCodes(data: {
  confirmPassword?: string;
}): Promise<MfaBackupCodesResponse> {
  const req = await api.post<MfaBackupCodesResponse>(
    "/mfa/generate-backup-codes",
    data,
  );
  return req.data;
}

export async function verifyMfa(code: string): Promise<any> {
  const req = await api.post("/mfa/verify", { code });
  return req.data;
}

export async function validateMfaAccess(): Promise<MfaAccessValidationResponse> {
  try {
    const res = await api.post("/mfa/validate-access");
    return res.data;
  } catch {
    return { valid: false };
  }
}
