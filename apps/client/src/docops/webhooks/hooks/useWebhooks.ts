import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  updateWebhook,
  type CreateWebhookPayload,
  type UpdateWebhookPayload,
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
