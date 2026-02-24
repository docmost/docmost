export type NotificationType =
  | "comment.user_mention"
  | "comment.created"
  | "comment.resolved"
  | "page.user_mention";

export type INotification = {
  id: string;
  userId: string;
  workspaceId: string;
  type: NotificationType;
  actorId: string | null;
  pageId: string | null;
  spaceId: string | null;
  commentId: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  emailedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  page: {
    id: string;
    title: string;
    slugId: string;
    icon: string | null;
  } | null;
  space: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type NotificationFilter = "all" | "unread";
