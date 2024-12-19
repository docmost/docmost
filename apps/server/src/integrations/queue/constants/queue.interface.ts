import { MentionNode } from "../../../common/helpers/prosemirror/utils";


export interface IPageBacklinkJob {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  mentions: MentionNode[];
}