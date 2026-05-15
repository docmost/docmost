import api from "@/lib/api-client";
import { IPagination } from "@/lib/types";
import {
  ICreateWebhook,
  IListWebhooksParams,
  IUpdateWebhook,
  IWebhook,
  IWebhookCreated,
  IWebhookDelivery,
} from "@/ee/webhook/types/webhook.types";

export async function getWebhooks(
  params?: IListWebhooksParams,
): Promise<IPagination<IWebhook>> {
  const req = await api.post("/webhooks", { ...params });
  return req.data;
}

export async function getWebhook(webhookId: string): Promise<IWebhook> {
  const req = await api.post<IWebhook>("/webhooks/info", { webhookId });
  return req.data;
}

export async function createWebhook(
  data: ICreateWebhook,
): Promise<IWebhookCreated> {
  const req = await api.post<IWebhookCreated>("/webhooks/create", data);
  return req.data;
}

export async function updateWebhook(data: IUpdateWebhook): Promise<IWebhook> {
  const req = await api.post<IWebhook>("/webhooks/update", data);
  return req.data;
}

export async function deleteWebhook(
  webhookId: string,
): Promise<{ success: boolean }> {
  const req = await api.post("/webhooks/delete", { webhookId });
  return req.data;
}

export async function rotateWebhookSecret(
  webhookId: string,
): Promise<{ signingSecret: string }> {
  const req = await api.post<{ signingSecret: string }>(
    "/webhooks/rotate-secret",
    { webhookId },
  );
  return req.data;
}

export async function sendWebhookTest(
  webhookId: string,
): Promise<{ deliveryId: string }> {
  const req = await api.post<{ deliveryId: string }>("/webhooks/test", {
    webhookId,
  });
  return req.data;
}

export async function getWebhookDeliveries(
  webhookId: string,
  limit?: number,
): Promise<IWebhookDelivery[]> {
  const req = await api.post<IWebhookDelivery[]>("/webhooks/deliveries", {
    webhookId,
    limit,
  });
  return req.data;
}

export async function redeliverWebhook(
  deliveryId: string,
): Promise<{ deliveryId: string }> {
  const req = await api.post<{ deliveryId: string }>(
    "/webhooks/deliveries/redeliver",
    { deliveryId },
  );
  return req.data;
}
