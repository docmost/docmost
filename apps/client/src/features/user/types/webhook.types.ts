export interface IWebhook {
  id: string;
  format: 'discord' | 'slack' | 'generic';
  enabled: boolean;
  events: string[];
  urlConfigured: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
}

export interface IWebhookResponse {
  webhook: IWebhook | null;
}

export interface IUpdateWebhookRequest {
  url: string;
  format?: 'discord' | 'slack' | 'generic';
  enabled?: boolean;
  events?: string[];
}

export interface IUpdateWebhookResponse {
  success: boolean;
  error?: string;
  webhook?: {
    id: string;
    format: string;
    enabled: boolean;
    events: string[];
  };
}

export interface ITestWebhookResponse {
  success: boolean;
  error?: string;
}

export const WEBHOOK_EVENTS = [
  { value: 'mention', label: 'Mentions' },
  { value: 'comment', label: 'Comments' },
  { value: 'page_update', label: 'Page Updates' },
  { value: 'page_delete', label: 'Page Deletions' },
] as const;

export const WEBHOOK_FORMATS = [
  { value: 'discord', label: 'Discord' },
  { value: 'slack', label: 'Slack' },
  { value: 'generic', label: 'Generic JSON' },
] as const;
