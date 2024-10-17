import { SpaceTreeNode } from "@/features/page/tree/types.ts";

export type InvalidateEvent = {
  operation: "invalidate";
  entity: Array<string>;
  id?: string;
};

export type UpdateEvent = {
  operation: "updateOne";
  entity: Array<string>;
  id: string;
  payload: Partial<any>;
};

export type DeleteEvent = {
  operation: "deleteOne";
  entity: Array<string>;
  id: string;
  payload?: Partial<any>;
};

export type AddTreeNodeEvent = {
  operation: "addTreeNode";
  payload: {
    parentId: string;
    index: number;
    data: SpaceTreeNode;
  };
};

export type MoveTreeNodeEvent = {
  operation: "moveTreeNode";
  payload: {
    id: string;
    parentId: string;
    index: number;
    position: string;
  }
};

export type DeleteTreeNodeEvent = {
  operation: "deleteTreeNode";
  payload: {
    node: SpaceTreeNode
  }
};

export type WebSocketEvent = InvalidateEvent | UpdateEvent | DeleteEvent | AddTreeNodeEvent | MoveTreeNodeEvent | DeleteTreeNodeEvent;
