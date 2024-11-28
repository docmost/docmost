import { SpaceTreeNode } from "@/features/page/tree/types.ts";

export type InvalidateEvent = {
  operation: "invalidate";
  spaceId: string;
  entity: Array<string>;
  id?: string;
};

export type UpdateEvent = {
  operation: "updateOne";
  spaceId: string;
  entity: Array<string>;
  id: string;
  payload: Partial<any>;
};

export type DeleteEvent = {
  operation: "deleteOne";
  spaceId: string;
  entity: Array<string>;
  id: string;
  payload?: Partial<any>;
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
    index: number;
    position: string;
  }
};

export type DeleteTreeNodeEvent = {
  operation: "deleteTreeNode";
  spaceId: string;
  payload: {
    node: SpaceTreeNode
  }
};

export type WebSocketEvent = InvalidateEvent | UpdateEvent | DeleteEvent | AddTreeNodeEvent | MoveTreeNodeEvent | DeleteTreeNodeEvent;
