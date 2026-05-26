import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  updateWebhook,
  listWebhookDeliveries,
  pingWebhook,
  type CreateWebhookPayload,
  type UpdateWebhookPayload,
  type WebhookDelivery,
  type PingResult,
} from "../api/webhooks.api";

const QUERY_KEY = ["docops-webhooks"];

export function useWebhooksQuery() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: listWebhooks,
  });
}

export function useCreateWebhookMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWebhookPayload) => createWebhook(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateWebhookMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateWebhookPayload) => updateWebhook(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteWebhookMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useWebhookDeliveriesQuery(webhookId: string | null) {
  return useQuery({
    queryKey: ["docops-webhook-deliveries", webhookId],
    queryFn: () => listWebhookDeliveries(webhookId!),
    enabled: webhookId !== null,
  });
}

export function usePingWebhookMutation() {
  return useMutation({
    mutationFn: (webhookId: string) => pingWebhook(webhookId),
  });
}
