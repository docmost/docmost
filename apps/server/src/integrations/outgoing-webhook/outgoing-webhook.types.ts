export const outgoingWebhookEvents = [
  'page.created',
  'page.updated',
  'page.moved',
  'page.deleted',
  'page.restored',
] as const;

export type OutgoingWebhookEvent = (typeof outgoingWebhookEvents)[number];

export interface OutgoingWebhookPayload {
  version: '1';
  id: string;
  event: OutgoingWebhookEvent;
  occurredAt: string;
  workspaceId?: string;
  data: {
    pageId: string;
  };
}
