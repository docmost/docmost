export const NotificationType = {
  COMMENT_USER_MENTION: 'comment.user_mention',
  COMMENT_CREATED: 'comment.created',
  COMMENT_RESOLVED: 'comment.resolved',
  PAGE_USER_MENTION: 'page.user_mention',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];
