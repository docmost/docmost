export const NotificationType = {
  COMMENT_USER_MENTION: 'comment.user_mention',
  COMMENT_NEW_COMMENT: 'comment.new_comment',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];
