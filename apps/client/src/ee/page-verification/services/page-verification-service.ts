import api from "@/lib/api-client";
import {
  IPageVerificationInfo,
  ISetupVerification,
  IUpdateVerification,
  IVerificationListItem,
  IVerificationListParams,
} from "@/ee/page-verification/types/page-verification.types";
import { IPagination } from "@/lib/types";

export async function getVerificationInfo(
  pageId: string,
): Promise<IPageVerificationInfo> {
  const req = await api.post<IPageVerificationInfo>(
    "/pages/verification-info",
    { pageId },
  );
  return req.data;
}

export async function setupVerification(
  data: ISetupVerification,
): Promise<void> {
  await api.post("/pages/create-verification", data);
}

export async function updateVerification(
  data: IUpdateVerification,
): Promise<void> {
  await api.post("/pages/update-verification", data);
}

export async function removeVerification(pageId: string): Promise<void> {
  await api.post("/pages/delete-verification", { pageId });
}

export async function verifyPage(pageId: string): Promise<void> {
  await api.post("/pages/verify", { pageId });
}

export async function submitForApproval(pageId: string): Promise<void> {
  await api.post("/pages/submit-for-approval", { pageId });
}

export async function rejectApproval(data: {
  pageId: string;
  comment?: string;
}): Promise<void> {
  await api.post("/pages/reject-approval", data);
}

export async function markObsolete(pageId: string): Promise<void> {
  await api.post("/pages/mark-obsolete", { pageId });
}

export async function getVerificationList(
  params?: IVerificationListParams,
): Promise<IPagination<IVerificationListItem>> {
  const req = await api.post("/pages/verifications", { ...params });
  return req.data;
}
