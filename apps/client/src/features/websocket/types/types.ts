import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { IPage } from "@/features/page/types/page.types";

export type InvalidateEvent = {
  operation: "invalidate";
  spaceId: string;
  entity: Array<string>;
  id?: string;
};

export type InvalidateCommentsEvent = {
  operation: "invalidateComment";
  pageId: string;
};

export type UpdateEvent = {
  operation: "updateOne";
  spaceId: string;
  entity: Array<string>;
  id: string;
  payload: Partial<IPage>;
};

export type DeleteEvent = {
  operation: "deleteOne";
  spaceId: string;
  entity: Array<string>;
  id: string;
  payload?: Partial<IPage>;
};

export type AddTreeNodeEvent = {
  operation: "addTreeNode";
  spaceId: string;
  payload: {
    parentId: string;
    index: number;
    data: SpaceTreeNode;
  };
};

export type MoveTreeNodeEvent = {
  operation: "moveTreeNode";
  spaceId: string;
  payload: {
    id: string;
    parentId: string;
    oldParentId: string | null;
    index: number;
    position: string;
    pageData: Partial<IPage>;
  };
};

export type DeleteTreeNodeEvent = {
  operation: "deleteTreeNode";
  spaceId: string;
  payload: {
    node: SpaceTreeNode;
  };
};

export type RefetchRootTreeNodeEvent = {
  operation: "refetchRootTreeNodeEvent";
  spaceId: string;
};

export type ResolveCommentEvent = {
  operation: "resolveComment";
  pageId: string;
  commentId: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedById?: string;
  resolvedBy?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
};

export type WebSocketEvent =
  | InvalidateEvent
  | InvalidateCommentsEvent
  | UpdateEvent
  | DeleteEvent
  | AddTreeNodeEvent
  | MoveTreeNodeEvent
  | DeleteTreeNodeEvent
  | RefetchRootTreeNodeEvent
  | ResolveCommentEvent;
