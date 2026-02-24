import api from "@/lib/api-client";
import {
  IWebhookResponse,
  IUpdateWebhookRequest,
  IUpdateWebhookResponse,
  ITestWebhookResponse,
} from "@/features/user/types/webhook.types";

export async function getWebhook(): Promise<IWebhookResponse> {
  const req = await api.get<IWebhookResponse>("/webhooks");
  return req as unknown as IWebhookResponse;
}

export async function updateWebhook(
  data: IUpdateWebhookRequest
): Promise<IUpdateWebhookResponse> {
  const req = await api.post<IUpdateWebhookResponse>("/webhooks", data);
  return req as unknown as IUpdateWebhookResponse;
}

export async function deleteWebhook(): Promise<{ success: boolean }> {
  const req = await api.delete<{ success: boolean }>("/webhooks");
  return req as unknown as { success: boolean };
}

export async function testWebhook(): Promise<ITestWebhookResponse> {
  const req = await api.post<ITestWebhookResponse>("/webhooks/test");
  return req as unknown as ITestWebhookResponse;
}
