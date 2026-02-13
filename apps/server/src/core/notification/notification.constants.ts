export const NotificationType = {
  COMMENT_USER_MENTION: 'comment.user_mention',
  COMMENT_CREATED: 'comment.created',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];
