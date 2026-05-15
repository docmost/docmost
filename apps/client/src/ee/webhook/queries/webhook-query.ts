import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  createWebhook,
  deleteWebhook,
  getWebhook,
  getWebhookDeliveries,
  getWebhooks,
  redeliverWebhook,
  rotateWebhookSecret,
  sendWebhookTest,
  updateWebhook,
} from "@/ee/webhook/services/webhook-service";
import {
  ICreateWebhook,
  IListWebhooksParams,
  IUpdateWebhook,
  IWebhook,
  IWebhookCreated,
  IWebhookDelivery,
} from "@/ee/webhook/types/webhook.types";
import { IPagination } from "@/lib/types";

const WEBHOOK_LIST_KEY = "webhook-list";
const WEBHOOK_INFO_KEY = "webhook-info";
const WEBHOOK_DELIVERIES_KEY = "webhook-deliveries";

export function useWebhooks(
  params?: IListWebhooksParams,
): UseQueryResult<IPagination<IWebhook>, Error> {
  return useQuery({
    queryKey: [WEBHOOK_LIST_KEY, params],
    queryFn: () => getWebhooks(params),
    placeholderData: keepPreviousData,
  });
}

export function useWebhook(
  webhookId: string | null | undefined,
): UseQueryResult<IWebhook, Error> {
  return useQuery({
    queryKey: [WEBHOOK_INFO_KEY, webhookId],
    queryFn: () => getWebhook(webhookId as string),
    enabled: !!webhookId,
  });
}

export function useWebhookDeliveries(
  webhookId: string | null | undefined,
): UseQueryResult<IWebhookDelivery[], Error> {
  return useQuery({
    queryKey: [WEBHOOK_DELIVERIES_KEY, webhookId],
    queryFn: () => getWebhookDeliveries(webhookId as string),
    enabled: !!webhookId,
  });
}

function invalidateLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({
    predicate: (item) => item.queryKey[0] === WEBHOOK_LIST_KEY,
  });
}

export function useCreateWebhookMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IWebhookCreated, Error, ICreateWebhook>({
    mutationFn: (data) => createWebhook(data),
    onSuccess: () => {
      notifications.show({ message: t("Webhook created") });
      invalidateLists(queryClient);
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useUpdateWebhookMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IWebhook, Error, IUpdateWebhook>({
    mutationFn: (data) => updateWebhook(data),
    onSuccess: (data) => {
      notifications.show({ message: t("Webhook updated") });
      invalidateLists(queryClient);
      queryClient.invalidateQueries({
        queryKey: [WEBHOOK_INFO_KEY, data.id],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useDeleteWebhookMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<{ success: boolean }, Error, { webhookId: string }>({
    mutationFn: ({ webhookId }) => deleteWebhook(webhookId),
    onSuccess: () => {
      notifications.show({ message: t("Webhook deleted") });
      invalidateLists(queryClient);
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useRotateSecretMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    { signingSecret: string },
    Error,
    { webhookId: string }
  >({
    mutationFn: ({ webhookId }) => rotateWebhookSecret(webhookId),
    onSuccess: (_data, variables) => {
      notifications.show({ message: t("Signing secret rotated") });
      queryClient.invalidateQueries({
        queryKey: [WEBHOOK_INFO_KEY, variables.webhookId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useSendTestMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<{ deliveryId: string }, Error, { webhookId: string }>({
    mutationFn: ({ webhookId }) => sendWebhookTest(webhookId),
    onSuccess: (_data, variables) => {
      notifications.show({ message: t("Test event sent") });
      queryClient.invalidateQueries({
        queryKey: [WEBHOOK_DELIVERIES_KEY, variables.webhookId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useRedeliverMutation(webhookId?: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<{ deliveryId: string }, Error, { deliveryId: string }>({
    mutationFn: ({ deliveryId }) => redeliverWebhook(deliveryId),
    onSuccess: () => {
      notifications.show({ message: t("Redelivery queued") });
      if (webhookId) {
        queryClient.invalidateQueries({
          queryKey: [WEBHOOK_DELIVERIES_KEY, webhookId],
        });
      } else {
        queryClient.invalidateQueries({
          predicate: (item) => item.queryKey[0] === WEBHOOK_DELIVERIES_KEY,
        });
      }
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}
