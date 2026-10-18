import api from "@/lib/api-client";
import {
  IPageVerificationInfo,
  IRejectApproval,
  IRemoveVerification,
  ISetupVerification,
  ISpaceApprovalInfo,
  ISubmitForApproval,
  IUpdateSpaceApprovalSettings,
  IUpdateVerification,
  IVerificationListItem,
  IVerificationListParams,
  IVerifyPage,
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

export async function removeVerification(
  data: IRemoveVerification,
): Promise<void> {
  await api.post("/pages/delete-verification", data);
}

export async function verifyPage(data: IVerifyPage): Promise<void> {
  await api.post("/pages/verify", data);
}

export async function submitForApproval(
  data: ISubmitForApproval,
): Promise<void> {
  await api.post("/pages/submit-for-approval", data);
}

export async function rejectApproval(data: IRejectApproval): Promise<void> {
  await api.post("/pages/reject-approval", data);
}

export async function withdrawApproval(pageId: string): Promise<void> {
  await api.post("/pages/withdraw-approval", { pageId });
}

export async function markObsolete(pageId: string): Promise<void> {
  await api.post("/pages/mark-obsolete", { pageId });
}

export async function restoreObsolete(pageId: string): Promise<void> {
  await api.post("/pages/restore-obsolete", { pageId });
}

export async function getVerificationList(
  params?: IVerificationListParams,
): Promise<IPagination<IVerificationListItem>> {
  const req = await api.post("/pages/verifications", { ...params });
  return req.data;
}

export async function getSpaceApprovalSettings(
  spaceId: string,
): Promise<ISpaceApprovalInfo> {
  const req = await api.post<ISpaceApprovalInfo>(
    "/spaces/approval-settings",
    { spaceId },
  );
  return req.data;
}

export async function updateSpaceApprovalSettings(
  data: IUpdateSpaceApprovalSettings,
): Promise<void> {
  await api.post("/spaces/update-approval-settings", data);
}
