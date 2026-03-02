import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { IPage } from "@/features/page/types/page.types";
import { IComment } from "@/features/comment/types/comment.types";

export type InvalidateEvent = {
  operation: "invalidate";
  spaceId: string;
  entity: Array<string>;
  id?: string;
};

export type CommentCreatedEvent = {
  operation: "commentCreated";
  pageId: string;
  comment: IComment;
};

export type CommentUpdatedEvent = {
  operation: "commentUpdated";
  pageId: string;
  comment: IComment;
};

export type CommentDeletedEvent = {
  operation: "commentDeleted";
  pageId: string;
  commentId: string;
};

export type CommentResolvedEvent = {
  operation: "commentResolved";
  pageId: string;
  comment: IComment;
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

export type WebSocketEvent =
  | InvalidateEvent
  | CommentCreatedEvent
  | CommentUpdatedEvent
  | CommentDeletedEvent
  | CommentResolvedEvent
  | UpdateEvent
  | DeleteEvent
  | AddTreeNodeEvent
  | MoveTreeNodeEvent
  | DeleteTreeNodeEvent
  | RefetchRootTreeNodeEvent;
