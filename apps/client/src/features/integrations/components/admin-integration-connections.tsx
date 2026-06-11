import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconAlertCircle, IconPlug } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetIntegrationConnectionsQuery,
  useSaveIntegrationConnectionMutation,
} from "@/features/integrations/queries/integration-oauth-query";
import { IntegrationOAuthConnection } from "@/features/integrations/types/integration.types";

export default function AdminIntegrationConnections() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useGetIntegrationConnectionsQuery();
  const [addOpened, setAddOpened] = useState(false);

  const providers = useMemo(() => {
    const byProvider = new Map<string, IntegrationOAuthConnection>();
    for (const connection of data ?? []) {
      const providerId = connection.providerId ?? connection.integrationId;
      if (!byProvider.has(providerId)) {
        byProvider.set(providerId, { ...connection, providerId });
      }
    }
    return [...byProvider.values()];
  }, [data]);

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle />}>
        {t("Failed to load integration connections")}
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Alert color="gray" icon={<IconPlug />}>
        {t("No integration providers are available in this deployment.")}
      </Alert>
    );
  }

  const openAddIntegration = () => {
    setAddOpened(true);
  };

  const closeAdd = () => {
    setAddOpened(false);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Text size="sm" c="dimmed" style={{ flex: 1 }}>
          {t(
            "Configure base connections for integrations available in this Docmost workspace. This registers provider details only; each member still connects their own account from Account → Integrations.",
          )}
        </Text>
        <Button size="sm" onClick={openAddIntegration}>
          {t("Add integration")}
        </Button>
      </Group>

      {data.map((connection) => (
        <AdminIntegrationConnectionCard
          key={connection.integrationId}
          connection={connection}
          providers={providers}
        />
      ))}

      <Modal
        opened={addOpened}
        onClose={closeAdd}
        title={t("Add integration")}
        size="lg"
      >
        <AdminIntegrationConnectionForm
          mode="add"
          connection={null}
          providers={providers}
          onSaved={closeAdd}
        />
      </Modal>
    </Stack>
  );
}

function AdminIntegrationConnectionCard({
  connection,
  providers,
}: {
  connection: IntegrationOAuthConnection;
  providers: IntegrationOAuthConnection[];
}) {
  const { t } = useTranslation();
  const [configureOpened, setConfigureOpened] = useState(false);

  return (
    <>
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Group gap="sm" align="center">
              <Text fw={600}>{connection.name}</Text>
              {connection.configured ? (
                <Badge
                  color={connection.enabled ? "green" : "gray"}
                  variant="light"
                >
                  {connection.enabled ? t("Enabled") : t("Disabled")}
                </Badge>
              ) : (
                <Badge color="orange" variant="light">
                  {t("Not configured")}
                </Badge>
              )}
              {connection.source === "env" && (
                <Badge variant="default">{t("Env default")}</Badge>
              )}
            </Group>

            {connection.description && (
              <Text size="sm" c="dimmed">
                {connection.description}
              </Text>
            )}

            {connection.configured && (
              <Group gap="xs">
                {connection.baseUrl && (
                  <Text size="sm" c="dimmed">
                    {connection.baseUrl}
                  </Text>
                )}
                {connection.settingsFields
                  .filter((field) => connection.settings?.[field.key])
                  .map((field) => (
                    <Badge key={field.key} variant="default" size="xs">
                      {field.label}: {connection.settings?.[field.key]}
                    </Badge>
                  ))}
              </Group>
            )}

            {connection.scopes.length > 0 && (
              <Group gap={4} mt={4}>
                {connection.scopes.map((scope) => (
                  <Badge key={scope} variant="default" size="xs">
                    {scope}
                  </Badge>
                ))}
              </Group>
            )}
          </Stack>

          <Button variant="default" onClick={() => setConfigureOpened(true)}>
            {connection.configured ? t("Edit") : t("Configure")}
          </Button>
        </Group>
      </Card>

      <Modal
        opened={configureOpened}
        onClose={() => setConfigureOpened(false)}
        title={t("Configure integration")}
        size="lg"
      >
        <AdminIntegrationConnectionForm
          mode="edit"
          connection={connection}
          providers={providers}
          onSaved={() => setConfigureOpened(false)}
        />
      </Modal>
    </>
  );
}

function AdminIntegrationConnectionForm({
  mode,
  connection,
  providers,
  onSaved,
}: {
  mode: "add" | "edit";
  connection: IntegrationOAuthConnection | null;
  providers: IntegrationOAuthConnection[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveIntegrationConnectionMutation();
  const isEdit = mode === "edit";
  const [selectedProviderId, setSelectedProviderId] = useState(
    connection?.providerId ?? "",
  );
  const [integrationId, setIntegrationId] = useState(
    connection?.integrationId ?? "",
  );
  const [enabled, setEnabled] = useState(connection?.enabled ?? true);
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? "");
  const [oauthClientId, setOauthClientId] = useState(
    connection?.oauthClientId ?? "",
  );
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>(
    connection?.settings ?? {},
  );

  const selectedProvider = useMemo(() => {
    return (
      providers.find(
        (provider) => provider.providerId === selectedProviderId,
      ) ?? (connection?.providerId === selectedProviderId ? connection : null)
    );
  }, [connection, providers, selectedProviderId]);

  const providerOptions = useMemo(() => {
    const options = providers.map((provider) => ({
      value: provider.providerId,
      label: provider.name,
    }));
    if (
      connection?.providerId &&
      !options.some((option) => option.value === connection.providerId)
    ) {
      options.push({ value: connection.providerId, label: connection.name });
    }
    return options;
  }, [connection, providers]);

  useEffect(() => {
    setSelectedProviderId(connection?.providerId ?? "");
    setIntegrationId(connection?.integrationId ?? "");
    setEnabled(connection?.enabled ?? true);
    setBaseUrl(connection?.baseUrl ?? "");
    setOauthClientId(connection?.oauthClientId ?? "");
    setOauthClientSecret("");
    setSettings(connection?.settings ?? {});
  }, [connection]);

  const onProviderChange = (providerId: string | null) => {
    setSelectedProviderId(providerId ?? "");
    setIntegrationId(providerId ? newIntegrationId(providerId) : "");
    setEnabled(true);
    setBaseUrl("");
    setOauthClientId("");
    setOauthClientSecret("");
    setSettings({});
  };

  const onSave = () => {
    if (!selectedProvider || !integrationId) return;
    save.mutate(
      {
        integrationId,
        input: {
          enabled,
          baseUrl,
          oauthClientId,
          oauthClientSecret:
            oauthClientSecret.length > 0 ? oauthClientSecret : undefined,
          settings,
        },
      },
      { onSuccess: onSaved },
    );
  };

  const settingsFields = selectedProvider?.settingsFields ?? [];
  const missingRequiredSetting = settingsFields.some(
    (field) => field.required && !settings[field.key]?.trim(),
  );
  const redirectUri = selectedProvider
    ? callbackUrlFor(selectedProvider.redirectUri, integrationId)
    : "";

  return (
    <Stack gap="md">
      <Select
        label={t("Integration type")}
        placeholder={t("Select an integration type")}
        data={providerOptions}
        value={selectedProviderId || null}
        onChange={onProviderChange}
        disabled={isEdit}
        required
      />

      {!selectedProvider ? (
        <Text size="sm" c="dimmed">
          {t(
            "Choose an integration type to configure its provider-specific settings.",
          )}
        </Text>
      ) : (
        <>
          <Group justify="space-between" align="flex-start">
            <Stack gap={4} style={{ flex: 1 }}>
              <Text fw={600}>{selectedProvider.name}</Text>
              {selectedProvider.description && (
                <Text size="sm" c="dimmed">
                  {selectedProvider.description}
                </Text>
              )}
            </Stack>
            <Switch
              checked={enabled}
              onChange={(event) => setEnabled(event.currentTarget.checked)}
              label={t("Enabled")}
            />
          </Group>

          <TextInput
            label={t("Base URL")}
            placeholder={selectedProvider.baseUrlPlaceholder ?? "https://"}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.currentTarget.value)}
            required
          />
          <TextInput
            label={t("OAuth client ID")}
            value={oauthClientId}
            onChange={(event) => setOauthClientId(event.currentTarget.value)}
            required
          />
          <PasswordInput
            label={t("OAuth client secret")}
            description={
              isEdit && connection?.hasClientSecret
                ? t("Leave blank to keep the stored secret.")
                : undefined
            }
            value={oauthClientSecret}
            onChange={(event) =>
              setOauthClientSecret(event.currentTarget.value)
            }
          />
          {settingsFields.map((field) => (
            <TextInput
              key={field.key}
              label={t(field.label)}
              description={field.description ? t(field.description) : undefined}
              placeholder={field.placeholder}
              value={settings[field.key] ?? ""}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  [field.key]: event.currentTarget.value,
                })
              }
              required={field.required}
            />
          ))}

          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {t("Redirect URI")}
            </Text>
            <Group gap="xs" align="center">
              <Code>{redirectUri}</Code>
              <CopyButton value={redirectUri}>
                {({ copy, copied }) => (
                  <Button size="xs" variant="default" onClick={copy}>
                    {copied ? t("Copied") : t("Copy")}
                  </Button>
                )}
              </CopyButton>
            </Group>
          </Stack>

          <Group gap={4}>
            {selectedProvider.scopes.map((scope) => (
              <Badge key={scope} variant="default" size="xs">
                {scope}
              </Badge>
            ))}
          </Group>
        </>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={onSaved} disabled={save.isPending}>
          {t("Cancel")}
        </Button>
        <Button
          onClick={onSave}
          loading={save.isPending}
          disabled={
            !selectedProvider ||
            !integrationId ||
            !baseUrl.trim() ||
            !oauthClientId.trim() ||
            missingRequiredSetting
          }
        >
          {t("Save configuration")}
        </Button>
      </Group>
    </Stack>
  );
}

function newIntegrationId(providerId: string): string {
  return `${providerId}:${crypto.randomUUID()}`;
}

function callbackUrlFor(template: string, integrationId: string): string {
  try {
    const url = new URL(template);
    const parts = url.pathname.split("/");
    const callbackIndex = parts.lastIndexOf("callback");
    if (callbackIndex > 0) {
      parts[callbackIndex - 1] = encodeURIComponent(integrationId);
      url.pathname = parts.join("/");
      return url.toString();
    }
  } catch {
    // fall through to origin-relative construction below
  }
  return `${window.location.origin}/api/integrations/oauth/${encodeURIComponent(integrationId)}/callback`;
}
