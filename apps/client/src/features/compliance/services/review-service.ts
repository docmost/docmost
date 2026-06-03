import api from "@/lib/api-client";
import { IPagination } from "@/lib/types.ts";
import {
  IComplianceScope,
  IReviewInfo,
  IReviewRecord,
  IReviewSetting,
  ReviewStatus,
} from "@/features/compliance/types/compliance.types.ts";

export async function getReviewInfo(
  scope: IComplianceScope,
): Promise<IReviewInfo> {
  const req = await api.post<IReviewInfo>("/compliance/reviews/get", scope);
  return req.data;
}

export async function setReview(
  data: IComplianceScope & { intervalDays: number },
): Promise<IReviewSetting> {
  const req = await api.post<IReviewSetting>("/compliance/reviews/set", data);
  return req.data;
}

export async function markReviewed(
  data: IComplianceScope & { note?: string },
): Promise<IReviewInfo> {
  const req = await api.post<IReviewInfo>(
    "/compliance/reviews/mark-reviewed",
    data,
  );
  return req.data;
}

export async function getReviewStatuses(
  spaceId: string,
): Promise<Record<string, ReviewStatus>> {
  const req = await api.post<Record<string, ReviewStatus>>(
    "/compliance/reviews/statuses",
    { spaceId },
  );
  return req.data;
}

export async function getReviewHistory(
  scope: IComplianceScope,
  cursor?: string,
): Promise<IPagination<IReviewRecord>> {
  const req = await api.post("/compliance/reviews/history", {
    ...scope,
    cursor,
  });
  return req.data;
}
