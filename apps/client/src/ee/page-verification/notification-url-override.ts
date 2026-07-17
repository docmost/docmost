import { INotification } from "@/features/notification/types/notification.types";

const REVIEW_NOTIFICATION_TYPES = new Set([
  "page.approval_requested",
  "page.approval_rejected",
  "page.approval_clarification_requested",
  "page.reverification_required",
]);

export function getReviewUrlOverride(
  notification: INotification,
): string | undefined {
  if (!notification.page || !REVIEW_NOTIFICATION_TYPES.has(notification.type)) {
    return undefined;
  }
  return `/review/${notification.page.id}`;
}
