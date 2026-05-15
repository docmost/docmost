import {
  Button,
  Group,
  Modal,
  MultiSelect,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod/v4";
import { useTranslation } from "react-i18next";
import { useCreateWebhookMutation } from "@/ee/webhook/queries/webhook-query";
import {
  EVENT_GROUPS,
  multiSelectData,
} from "@/ee/webhook/lib/webhook-event-labels";
import type { WebhookEvent } from "@/ee/webhook/types/webhook.types";

interface CreateWebhookModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: (signingSecret: string) => void;
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

export function CreateWebhookModal({
  opened,
  onClose,
  onSuccess,
}: CreateWebhookModalProps) {
  const { t } = useTranslation();
  const createWebhookMutation = useCreateWebhookMutation();

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      name: "",
      url: "",
      subscribedEvents: [],
      isActive: true,
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const handleSubmit = async (values: FormValues) => {
    try {
      const result = await createWebhookMutation.mutateAsync({
        name: values.name,
        url: values.url,
        subscribedEvents: values.subscribedEvents,
        isActive: values.isActive,
      });
      form.reset();
      onClose();
      onSuccess(result.signingSecret);
    } catch (_err) {
      // notification handled inside mutation
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Create webhook")}
      size="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label={t("Name")}
            placeholder={t("e.g. Production alerts")}
            required
            data-autofocus
            {...form.getInputProps("name")}
          />

          <TextInput
            label={t("URL")}
            placeholder="https://example.com/webhook"
            required
            {...form.getInputProps("url")}
          />

          <MultiSelect
            label={t("Events")}
            placeholder={t("Select events to subscribe to")}
            data={multiSelectData()}
            searchable
            clearable
            required
            {...form.getInputProps("subscribedEvents")}
          />

          <Switch
            label={t("Active")}
            description={t("Deliveries fire only when the webhook is active")}
            checked={form.values.isActive}
            onChange={(event) =>
              form.setFieldValue("isActive", event.currentTarget.checked)
            }
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" loading={createWebhookMutation.isPending}>
              {t("Create")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
