import api from "@/lib/api-client";

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  service_id: string | null;
  created_at: string;
}

export interface CreateWebhookPayload {
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive?: boolean;
  serviceId?: string;
}

export interface UpdateWebhookPayload {
  id: string;
  name?: string;
  url?: string;
  secret?: string;
  events?: string[];
  isActive?: boolean;
  serviceId?: string;
}

export async function listWebhooks(): Promise<WebhookConfig[]> {
  const res = await api.post("/docops/webhooks", {});
  return res.data;
}

export async function createWebhook(payload: CreateWebhookPayload): Promise<WebhookConfig> {
  const res = await api.post("/docops/webhooks/create", payload);
  return res.data;
}

export async function updateWebhook(payload: UpdateWebhookPayload): Promise<WebhookConfig> {
  const res = await api.post("/docops/webhooks/update", payload);
  return res.data;
}

export async function deleteWebhook(id: string): Promise<void> {
  await api.post("/docops/webhooks/delete", { id });
}

export interface WebhookDelivery {
  id: number;
  webhook_id: string;
  event: string;
  delivery_id: string;
  attempt_number: number;
  status_code: number | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface PingResult {
  webhookId: string;
  url: string;
  signature: string;
  payload: Record<string, any>;
  statusCode: number | null;
  success: boolean;
  errorMessage: string | null;
}

export async function listWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
  const res = await api.post("/docops/webhooks/deliveries", { webhookId });
  return res.data;
}

export async function pingWebhook(webhookId: string): Promise<PingResult> {
  const res = await api.post("/docops/webhooks/ping", { webhookId });
  return res.data;
}
