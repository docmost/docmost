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
