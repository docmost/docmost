import { useEffect, useState } from "react";
import {
  Button,
  Divider,
  Group,
  Modal,
  MultiSelect,
  PasswordInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod/v4";
import { useTranslation } from "react-i18next";
import {
  useRotateSecretMutation,
  useSendTestMutation,
  useUpdateWebhookMutation,
  useWebhook,
} from "@/ee/webhook/queries/webhook-query";
import {
  EVENT_GROUPS,
  multiSelectData,
} from "@/ee/webhook/lib/webhook-event-labels";
import type { WebhookEvent } from "@/ee/webhook/types/webhook.types";
import { WebhookSecretModal } from "@/ee/webhook/components/webhook-secret-modal";

interface EditWebhookModalProps {
  opened: boolean;
  onClose: () => void;
  webhookId: string | null;
}

const allowedEvents: WebhookEvent[] = EVENT_GROUPS.flatMap((g) => g.events);

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  url: z
    .string()
    .min(1, "URL is required")
    .refine(
      (value) => /^https?:\/\//i.test(value),
      "URL must start with http:// or https://",
    ),
  subscribedEvents: z
    .array(z.enum(allowedEvents as [WebhookEvent, ...WebhookEvent[]]))
    .min(1, "Select at least one event"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export function EditWebhookModal({
  opened,
  onClose,
  webhookId,
}: EditWebhookModalProps) {
  const { t } = useTranslation();
  const { data: webhook, isLoading } = useWebhook(opened ? webhookId : null);
  const updateMutation = useUpdateWebhookMutation();
  const rotateMutation = useRotateSecretMutation();
  const sendTestMutation = useSendTestMutation();

  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      name: "",
      url: "",
      subscribedEvents: [],
      isActive: true,
    },
  });

  useEffect(() => {
    if (opened && webhook) {
      form.setValues({
        name: webhook.name,
        url: webhook.url,
        subscribedEvents: webhook.subscribedEvents,
        isActive: webhook.isActive,
      });
      form.resetDirty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, webhook?.id]);

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const handleSubmit = async (values: FormValues) => {
    if (!webhookId) return;
    try {
      await updateMutation.mutateAsync({
        webhookId,
        name: values.name,
        url: values.url,
        subscribedEvents: values.subscribedEvents,
        isActive: values.isActive,
      });
      onClose();
    } catch (_err) {
      // notification handled inside mutation
    }
  };

  const handleRotate = async () => {
    if (!webhookId) return;
    try {
      const result = await rotateMutation.mutateAsync({ webhookId });
      setRevealedSecret(result.signingSecret);
    } catch (_err) {
      // notification handled inside mutation
    }
  };

  const handleSendTest = async () => {
    if (!webhookId) return;
    try {
      await sendTestMutation.mutateAsync({ webhookId });
    } catch (_err) {
      // notification handled inside mutation
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        title={t("Edit webhook")}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label={t("Name")}
              placeholder={t("e.g. Production alerts")}
              required
              disabled={isLoading}
              {...form.getInputProps("name")}
            />

            <TextInput
              label={t("URL")}
              placeholder="https://example.com/webhook"
              required
              disabled={isLoading}
              {...form.getInputProps("url")}
            />

            <MultiSelect
              label={t("Events")}
              placeholder={t("Select events to subscribe to")}
              data={multiSelectData()}
              searchable
              clearable
              required
              disabled={isLoading}
              {...form.getInputProps("subscribedEvents")}
            />

            <Switch
              label={t("Active")}
              description={t(
                "Deliveries fire only when the webhook is active",
              )}
              checked={form.values.isActive}
              disabled={isLoading}
              onChange={(event) =>
                form.setFieldValue("isActive", event.currentTarget.checked)
              }
            />

            <Divider my="xs" />

            <div>
              <Text size="sm" fw={500} mb="xs">
                {t("Signing secret")}
              </Text>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <PasswordInput
                  value="dm_wh_••••••••••••••••••••••••••••••••"
                  readOnly
                  visible={false}
                  style={{ flex: 1 }}
                />
                <Button
                  variant="default"
                  onClick={handleRotate}
                  loading={rotateMutation.isPending}
                >
                  {t("Rotate")}
                </Button>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>
                {t(
                  "Rotating generates a new signing secret. The previous secret stops working immediately.",
                )}
              </Text>
            </div>

            <Divider my="xs" />

            <Group justify="space-between" mt="md">
              <Button
                variant="default"
                onClick={handleSendTest}
                loading={sendTestMutation.isPending}
              >
                {t("Send test event")}
              </Button>

              <Group>
                <Button variant="default" onClick={handleClose}>
                  {t("Cancel")}
                </Button>
                <Button type="submit" loading={updateMutation.isPending}>
                  {t("Save")}
                </Button>
              </Group>
            </Group>
          </Stack>
        </form>
      </Modal>

      <WebhookSecretModal
        opened={!!revealedSecret}
        onClose={() => setRevealedSecret(null)}
        secret={revealedSecret}
      />
    </>
  );
}
