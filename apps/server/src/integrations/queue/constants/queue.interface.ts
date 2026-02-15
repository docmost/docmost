import { MentionNode } from "../../../common/helpers/prosemirror/utils";


export interface IPageBacklinkJob {
  pageId: string;
  workspaceId: string;
  mentions: MentionNode[];
}

export interface IAddPageWatchersJob {
  userIds: string[];
  pageId: string;
  spaceId: string;
  workspaceId: string;
}

export interface IStripeSeatsSyncJob {
  workspaceId: string;
}

export interface IPageHistoryJob {
  pageId: string;
}

export interface INotificationCreateJob {
  userId: string;
  workspaceId: string;
  type: string;
  actorId?: string;
  pageId?: string;
  spaceId?: string;
  commentId?: string;
  data?: Record<string, unknown>;
}

export interface ICommentNotificationJob {
  commentId: string;
  parentCommentId?: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
  mentionedUserIds: string[];
  notifyWatchers: boolean;
}

export interface ICommentResolvedNotificationJob {
  commentId: string;
  commentCreatorId: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
}

export interface IPageMentionNotificationJob {
  userMentions: { userId: string; mentionId: string; creatorId: string }[];
  oldMentionedUserIds: string[];
  pageId: string;
  spaceId: string;
  workspaceId: string;
}
