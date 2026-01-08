import { MentionNode } from "../../../common/helpers/prosemirror/mentions";


export interface IPageBacklinkJob {
  pageId: string;
  workspaceId: string;
  mentions: MentionNode[];
}

export interface IMentionEmailJob {
  workspaceId: string;
  source: 'page' | 'comment';
  mentionId: string;
  mentionedUserId: string;
  actorUserId: string;
  pageId?: string;
  commentId?: string;
}

export interface IStripeSeatsSyncJob {
  workspaceId: string;
}