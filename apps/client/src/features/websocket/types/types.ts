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


export type WebSocketEvent = InvalidateEvent | UpdateEvent | DeleteEvent;
