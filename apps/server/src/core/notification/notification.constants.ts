export const NotificationType = {
  COMMENT_USER_MENTION: 'comment.user_mention',
  COMMENT_CREATED: 'comment.created',
  COMMENT_RESOLVED: 'comment.resolved',
  PAGE_USER_MENTION: 'page.user_mention',
  PAGE_PERMISSION_GRANTED: 'page.permission_granted',
  PAGE_VERIFICATION_EXPIRING: 'page.verification_expiring',
  PAGE_VERIFICATION_EXPIRED: 'page.verification_expired',
  PAGE_VERIFIED: 'page.verified',
  PAGE_APPROVAL_REQUESTED: 'page.approval_requested',
  PAGE_APPROVAL_REJECTED: 'page.approval_rejected',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];
