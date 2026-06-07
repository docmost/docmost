export type OrganizeTaskStatus =
  | "open"
  | "running"
  | "succeeded"
  | "failed";

export interface IOrganizeEvent {
  id: string;
  organizeTaskId: string;
  pageId: string | null;
  title: string | null;
  step: string;
  status: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface IOrganizeTask {
  id: string;
  workspaceId: string;
  spaceId: string | null;
  source: string;
  status: OrganizeTaskStatus;
  title: string | null;
  total: number | null;
  completed: number;
  fileTaskId: string | null;
  shareToken: string;
  error: string | null;
  statusUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface IOrganizeTaskDetail extends IOrganizeTask {
  events: IOrganizeEvent[];
}

// SSE payloads relayed from the server
export interface IOrganizeStreamSnapshot {
  type: "snapshot";
  task: IOrganizeTaskDetail;
}

export interface IOrganizeStreamEvent {
  type: "event";
  event: IOrganizeEvent;
  completed: number;
  total: number | null;
  status: OrganizeTaskStatus;
}

export interface IOrganizeStreamDone {
  type: "done";
  status: OrganizeTaskStatus;
  completed?: number;
  total?: number | null;
  error?: string | null;
}

export type OrganizeStreamMessage =
  | IOrganizeStreamSnapshot
  | IOrganizeStreamEvent
  | IOrganizeStreamDone;
