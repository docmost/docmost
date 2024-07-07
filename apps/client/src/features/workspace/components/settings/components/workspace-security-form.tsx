import api from "@/lib/api-client";
import {
  Button,
  Switch,
  TextInput,
  PasswordInput,
  Text,
  Divider,
  Group,
  TagsInput,
  Checkbox,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { isEqual } from "lodash";
import { notifications } from "@mantine/notifications";

interface OIDCConfig {
  enabled: boolean;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  buttonName: string;
  jitEnabled: boolean;
}

export default function WorkspaceSecurityForm() {
  const [config, setConfig] = useState<OIDCConfig>({
    enabled: false,
    issuerUrl: "",
    clientId: "",
    clientSecret: "",
    buttonName: "",
    jitEnabled: false,
  });

  const initialConfig = useRef<OIDCConfig>({
    enabled: false,
    issuerUrl: "",
    clientId: "",
    clientSecret: "",
    buttonName: "",
    jitEnabled: false,
  });

  const [editingDomains, setEditingDomains] = useState(false);
  const initialDomains = useRef<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [hasDomainsChanged, setHasDomainsChanged] = useState(false);

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!isEqual(domains, initialDomains.current)) {
      setHasDomainsChanged(true);
    } else {
      setHasDomainsChanged(false);
    }
  }, [domains]);

  useEffect(() => {
    if (!isEqual(config, initialConfig.current)) {
      setHasChanges(true);
    } else {
      setHasChanges(false);
    }
  }, [config]);

  useEffect(() => {
    async function fetchConfig() {
      const [configResponse, domainResponse] = await Promise.all([
        api.get<OIDCConfig>("/auth/oidc-config"),
        api.get<{ domains: string[] }>("/auth/approved-domains"),
      ]);

      initialConfig.current = { ...configResponse.data, clientSecret: "" };
      setConfig({ ...config, ...configResponse.data });

      initialDomains.current = domainResponse.data.domains;
      setDomains(domainResponse.data.domains);
    }

    fetchConfig();
  }, []);

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { id, value } = event.target;

    if (id === "enabled") {
      setConfig((prev) => ({
        ...prev,
        enabled: event.target.checked,
      }));
      return;
    }

    if (id === "jitEnabled") {
      setConfig((prev) => ({
        ...prev,
        jitEnabled: event.target.checked,
      }));
      return;
    }

    setConfig((prev) => ({
      ...prev,
      [id]: value,
    }));
  }

  async function handleDomainsButton() {
    if (editingDomains && hasDomainsChanged) {
      try {
        await api.patch("/auth/approved-domains", { domains });
        initialDomains.current = domains;
        setHasDomainsChanged(false);
        setEditingDomains(false);
        notifications.show({
          message: "Domains updated successfully",
        });
      } catch {
        notifications.show({
          message: "Failed updating domains",
          color: "red",
        });
      }
      setEditingDomains(false);
    } else {
      setEditingDomains(!editingDomains);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const updatedFields: Partial<OIDCConfig> = {};

    Object.keys(config).forEach((key) => {
      if (config[key] !== initialConfig.current[key]) {
        updatedFields[key] = config[key];
      }
    });

    try {
      const { data } = await api.patch<OIDCConfig>(
        "/auth/oidc-config",
        updatedFields,
      );

      initialConfig.current = { ...config, clientSecret: "" };
      setHasChanges(false);
      setConfig({ ...data, clientSecret: "" });

      notifications.show({
        message: "Configuration updated successfully",
      });
    } catch {
      notifications.show({
        message: "Failed updating configuration",
        color: "red",
      });
    }
  }

  return (
    <>
      <div>
        <Text size="md">Approved Domains</Text>
        <Text size="sm" c="dimmed">
          If configured, only users with email addresses from these domains will
          be able to sign in.
        </Text>
      </div>
      <Group justify="space-between" wrap="nowrap" gap="xl" mt="md">
        <TagsInput
          variant="filled"
          value={domains}
          onChange={setDomains}
          disabled={!editingDomains}
        />

        <Button onClick={handleDomainsButton}>
          {editingDomains ? "Save" : "Edit"}
        </Button>
      </Group>

      <Divider my="md" />
      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Text size="md">SSO</Text>
          <Text size="sm" c="dimmed">
            Configure single sign-on settings.
          </Text>
        </div>

        <Switch
          id="enabled"
          label="Enabled"
          checked={config.enabled}
          onChange={handleInputChange}
          mt="md"
        />
      </Group>
      <form onSubmit={handleSubmit}>
        <TextInput
          id="issuerUrl"
          label="Issuer URL"
          variant="filled"
          mt="sm"
          disabled={!config.enabled}
          value={config.issuerUrl}
          onChange={handleInputChange}
        />

        <TextInput
          id="clientId"
          label="Client ID"
          variant="filled"
          mt="sm"
          disabled={!config.enabled}
          value={config.clientId}
          onChange={handleInputChange}
        />

        <PasswordInput
          id="clientSecret"
          label="Client Secret"
          variant="filled"
          mt="sm"
          disabled={!config.enabled}
          onChange={handleInputChange}
        />

        <TextInput
          id="buttonName"
          label="Button Name"
          variant="filled"
          mt="sm"
          disabled={!config.enabled}
          value={config.buttonName}
          onChange={handleInputChange}
        />

        <Switch
          id="jitEnabled"
          mt="md"
          label="Automatically create users from approved domains (JIT)"
          disabled={!config.enabled}
          checked={config.jitEnabled}
          onChange={handleInputChange}
        />

        <Button mt="md" type="submit" disabled={!hasChanges}>
          Save
        </Button>
      </form>
    </>
  );
}
