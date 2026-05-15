export type WebhookEvent =
  | "page.created"
  | "page.updated"
  | "page.moved"
  | "page.deleted"
  | "page.restored"
  | "comment.created"
  | "comment.updated"
  | "comment.deleted"
  | "comment.resolved"
  | "space.created"
  | "space.updated"
  | "space.deleted"
  | "attachment.uploaded"
  | "user.created"
  | "user.deactivated";

export type WebhookDeliveryStatus =
  | "pending"
  | "success"
  | "failed"
  | "skipped_cooldown"
  | "skipped_disabled"
  | "skipped_inflight";

export interface IWebhook {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  subscribedEvents: WebhookEvent[];
  isActive: boolean;
  consecutiveFailureCount: number;
  disabledAt: string | null;
  creatorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IWebhookCreated extends IWebhook {
  signingSecret: string;
}

export interface IWebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  httpStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  attemptCount: number;
  durationMs: number | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface ICreateWebhook {
  name: string;
  url: string;
  subscribedEvents: WebhookEvent[];
  isActive?: boolean;
}

export interface IUpdateWebhook {
  webhookId: string;
  name?: string;
  url?: string;
  subscribedEvents?: WebhookEvent[];
  isActive?: boolean;
}

export interface IListWebhooksParams {
  cursor?: string;
  limit?: number;
}
