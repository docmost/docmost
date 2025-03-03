import api from "@/lib/api-client.ts";
import { ILicenseInfo } from "@/ee/licence/types/license.types.ts";

export async function getLicenseInfo(): Promise<ILicenseInfo> {
  const req = await api.post<ILicenseInfo>("/license/info");
  return req.data;
}

export async function activateLicense(
  licenseKey: string,
): Promise<ILicenseInfo> {
  const req = await api.post<ILicenseInfo>("/license/activate", { licenseKey });
  return req.data;
}

export async function removeLicense(): Promise<void> {
  await api.post<void>("/license/remove");
}
