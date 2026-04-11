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
    "/page-verification/info",
    { pageId },
  );
  return req.data;
}

export async function setupVerification(
  data: ISetupVerification,
): Promise<void> {
  await api.post("/page-verification/setup", data);
}

export async function updateVerification(
  data: IUpdateVerification,
): Promise<void> {
  await api.post("/page-verification/update", data);
}

export async function removeVerification(pageId: string): Promise<void> {
  await api.post("/page-verification/remove", { pageId });
}

export async function verifyPage(pageId: string): Promise<void> {
  await api.post("/page-verification/verify", { pageId });
}

export async function submitForApproval(pageId: string): Promise<void> {
  await api.post("/page-verification/submit-for-approval", { pageId });
}

export async function rejectApproval(data: {
  pageId: string;
  comment?: string;
}): Promise<void> {
  await api.post("/page-verification/reject", data);
}

export async function markObsolete(pageId: string): Promise<void> {
  await api.post("/page-verification/obsolete", { pageId });
}

export async function getVerificationList(
  params?: IVerificationListParams,
): Promise<IPagination<IVerificationListItem>> {
  const req = await api.post("/page-verification/list", { ...params });
  return req.data;
}
