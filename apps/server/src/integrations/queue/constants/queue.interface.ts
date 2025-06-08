import { MentionNode } from "../../../common/helpers/prosemirror/utils";


export interface IPageBacklinkJob {
  pageId: string;
  workspaceId: string;
  mentions: MentionNode[];
}

export interface IStripeSeatsSyncJob {
  workspaceId: string;
}