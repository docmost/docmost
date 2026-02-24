import { useState, useEffect } from "react";
import {
  Group,
  Text,
  TextInput,
  Select,
  Button,
  Switch,
  Checkbox,
  Stack,
  Alert,
  Loader,
  Badge,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { IconAlertCircle, IconWebhook } from "@tabler/icons-react";
import {
  getWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
} from "@/features/user/services/webhook-service";
import {
  IWebhook,
  WEBHOOK_EVENTS,
  WEBHOOK_FORMATS,
} from "@/features/user/types/webhook.types";

interface WebhookFormValues {
  url: string;
  format: "discord" | "slack" | "generic";
  enabled: boolean;
  events: string[];
}

export default function WebhookSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [webhook, setWebhook] = useState<IWebhook | null>(null);
  const [showForm, setShowForm] = useState(false);

  const form = useForm<WebhookFormValues>({
    initialValues: {
      url: "",
      format: "discord",
      enabled: true,
      events: ["mention", "comment", "page_update"],
    },
    validate: {
      url: (value) => {
        if (!value) return t("URL is required");
        try {
          const url = new URL(value);
          if (url.protocol !== "https:" && url.hostname !== "localhost") {
            return t("URL must use HTTPS");
          }
        } catch {
          return t("Invalid URL");
        }
        return null;
      },
      events: (value) =>
        value.length === 0 ? t("Select at least one event") : null,
    },
  });

  useEffect(() => {
    loadWebhook();
  }, []);

  async function loadWebhook() {
    try {
      const response = await getWebhook();
      setWebhook(response.webhook);
      if (response.webhook) {
        form.setValues({
          url: "", // Don't expose URL
          format: response.webhook.format,
          enabled: response.webhook.enabled,
          events: response.webhook.events,
        });
      }
    } catch (err) {
      console.error("Failed to load webhook settings", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: WebhookFormValues) {
    setSaving(true);
    try {
      const response = await updateWebhook({
        url: values.url,
        format: values.format,
        enabled: values.enabled,
        events: values.events,
      });

      if (response.success) {
        notifications.show({
          message: t("Webhook settings saved"),
          color: "green",
        });
        setShowForm(false);
        loadWebhook();
      } else {
        notifications.show({
          message: response.error || t("Failed to save webhook"),
          color: "red",
        });
      }
    } catch (err) {
      console.error(err);
      notifications.show({
        message: t("Failed to save webhook settings"),
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const response = await testWebhook();
      if (response.success) {
        notifications.show({
          message: t("Test webhook sent"),
          color: "green",
        });
      } else {
        notifications.show({
          message: response.error || t("Failed to send test webhook"),
          color: "red",
        });
      }
    } catch (err) {
      console.error(err);
      notifications.show({
        message: t("Failed to send test webhook"),
        color: "red",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteWebhook();
      setWebhook(null);
      form.reset();
      notifications.show({
        message: t("Webhook removed"),
        color: "green",
      });
    } catch (err) {
      console.error(err);
      notifications.show({
        message: t("Failed to remove webhook"),
        color: "red",
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Group gap="xs">
            <IconWebhook size={20} />
            <Text size="md" fw={500}>
              {t("Webhook Notifications")}
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            {t("Receive notifications via Discord, Slack, or custom webhooks.")}
          </Text>
        </div>
      </Group>

      {webhook && !showForm ? (
        <Stack gap="sm">
          <Group gap="xs">
            <Badge
              color={webhook.enabled ? "green" : "gray"}
              variant="light"
            >
              {webhook.enabled ? t("Enabled") : t("Disabled")}
            </Badge>
            <Badge variant="light">
              {WEBHOOK_FORMATS.find((f) => f.value === webhook.format)?.label ||
                webhook.format}
            </Badge>
            {webhook.failureCount > 0 && (
              <Badge color="red" variant="light">
                {webhook.failureCount} {t("failures")}
              </Badge>
            )}
          </Group>

          <Text size="sm" c="dimmed">
            {t("Events")}: {webhook.events.map((e) => 
              WEBHOOK_EVENTS.find((ev) => ev.value === e)?.label || e
            ).join(", ")}
          </Text>

          <Group gap="sm">
            <Button
              variant="light"
              size="xs"
              onClick={() => setShowForm(true)}
            >
              {t("Edit")}
            </Button>
            <Button
              variant="light"
              size="xs"
              onClick={handleTest}
              loading={testing}
            >
              {t("Test")}
            </Button>
            <Button
              variant="light"
              color="red"
              size="xs"
              onClick={handleDelete}
              loading={deleting}
            >
              {t("Remove")}
            </Button>
          </Group>
        </Stack>
      ) : (
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {webhook && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="blue"
                variant="light"
              >
                {t("Enter a new URL to update your webhook configuration.")}
              </Alert>
            )}

            <TextInput
              label={t("Webhook URL")}
              placeholder="https://discord.com/api/webhooks/..."
              description={t("Must be HTTPS. For Discord, use the webhook URL from channel settings.")}
              {...form.getInputProps("url")}
            />

            <Select
              label={t("Format")}
              description={t("Choose the notification format for your platform.")}
              data={WEBHOOK_FORMATS.map((f) => ({
                value: f.value,
                label: t(f.label),
              }))}
              {...form.getInputProps("format")}
              allowDeselect={false}
            />

            <Checkbox.Group
              label={t("Events")}
              description={t("Select which events trigger webhook notifications.")}
              {...form.getInputProps("events")}
            >
              <Stack gap="xs" mt="xs">
                {WEBHOOK_EVENTS.map((event) => (
                  <Checkbox
                    key={event.value}
                    value={event.value}
                    label={t(event.label)}
                  />
                ))}
              </Stack>
            </Checkbox.Group>

            <Switch
              label={t("Enabled")}
              description={t("Toggle webhook notifications on or off.")}
              {...form.getInputProps("enabled", { type: "checkbox" })}
            />

            <Group gap="sm">
              <Button type="submit" loading={saving}>
                {t("Save")}
              </Button>
              {webhook && (
                <Button
                  variant="subtle"
                  onClick={() => setShowForm(false)}
                >
                  {t("Cancel")}
                </Button>
              )}
            </Group>
          </Stack>
        </form>
      )}

      {!webhook && !showForm && (
        <Button
          variant="light"
          leftSection={<IconWebhook size={16} />}
          onClick={() => setShowForm(true)}
        >
          {t("Configure Webhook")}
        </Button>
      )}
    </Stack>
  );
}
