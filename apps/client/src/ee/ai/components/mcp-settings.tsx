import {
  Anchor,
  Button,
  Group,
  List,
  Table,
  Text,
  Switch,
  TextInput,
  ActionIcon,
  Tooltip,
  Stack,
  Alert,
} from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { ITrustedOAuthClient } from "@/features/workspace/types/workspace.types.ts";
import { notifications } from "@mantine/notifications";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";
import { getAppUrl } from "@/lib/config.ts";
import {
  IconCheck,
  IconCopy,
  IconInfoCircle,
  IconTrash,
} from "@tabler/icons-react";
import { CopyButton } from "@/components/common/copy-button.tsx";

// Mirrors the server rule: an exact https origin, tolerating only a trailing slash.
function parseTrustedOrigin(value: string): string | null {
  const input = value.trim().toLowerCase();
  try {
    const url = new URL(input);
    if (url.protocol !== "https:") return null;
    if (input !== url.origin && input !== `${url.origin}/`) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export default function McpSettings() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(workspace?.settings?.ai?.mcp);
  const hasAccess = useHasFeature(Feature.MCP);
  const upgradeLabel = useUpgradeLabel();

  const [newClientName, setNewClientName] = useState("");
  const [newClientOrigin, setNewClientOrigin] = useState("");

  const mcpUrl = `${getAppUrl()}/mcp`;
  const storedTrustedClients = workspace?.trustedOauthClients;
  const trustedClients = Array.isArray(storedTrustedClients)
    ? storedTrustedClients
    : [];

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      const updatedWorkspace = await updateWorkspace({ mcpEnabled: value });
      setChecked(value);
      setWorkspace(updatedWorkspace);
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message,
        color: "red",
      });
    }
  };

  const saveTrustedClients = async (next: ITrustedOAuthClient[]) => {
    try {
      const updatedWorkspace = await updateWorkspace({
        trustedOauthClients: next,
      });
      setWorkspace(updatedWorkspace);
      return true;
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message,
        color: "red",
      });
      return false;
    }
  };

  const handleAddTrustedClient = async () => {
    const name = newClientName.trim();
    const origin = parseTrustedOrigin(newClientOrigin);
    if (!origin) {
      notifications.show({
        message: t("Enter the app's callback origin, e.g. https://app.yourcompany.com"),
        color: "red",
      });
      return;
    }
    if (trustedClients.some((client) => client.origin.toLowerCase() === origin)) {
      notifications.show({
        message: t("This origin is already trusted."),
        color: "red",
      });
      return;
    }
    if (await saveTrustedClients([...trustedClients, { origin, name }])) {
      setNewClientName("");
      setNewClientOrigin("");
    }
  };

  const handleRemoveTrustedClient = (origin: string) => {
    void saveTrustedClients(
      trustedClients.filter((client) => client.origin !== origin),
    );
  };

  return (
    <Stack gap="lg">
      {!hasAccess && (
        <Alert icon={<IconInfoCircle />} title={upgradeLabel} color="blue">
          {t(
            "MCP is only available in the Docmost enterprise edition. Contact sales@docmost.com.",
          )}
        </Alert>
      )}

      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Text size="md">{t("Model Context Protocol (MCP)")}</Text>
          <Text size="sm" c="dimmed">
            {t(
              "Enable the MCP server to allow AI assistants and tools to interact with your workspace content.",
            )}{" "}
            <Trans
              i18nKey="View the <anchor>MCP documentation</anchor>."
              components={{
                anchor: <Anchor href="https://docmost.com/docs/user-guide/mcp" target="_blank" size="sm" />,
              }}
            />
          </Text>
        </div>

        <Tooltip label={upgradeLabel} disabled={hasAccess} refProp="rootRef">
          <Switch
            defaultChecked={checked}
            onChange={handleChange}
            disabled={!hasAccess}
          />
        </Tooltip>
      </Group>

      {checked && (
        <div>
          <Text size="sm" fw={500} mb={4}>
            {t("MCP Server URL")}
          </Text>
          <Group gap="xs">
            <TextInput value={mcpUrl} readOnly style={{ flex: 1 }} />
            <CopyButton value={mcpUrl} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip
                  label={copied ? t("Copied") : t("Copy")}
                  withArrow
                  position="right"
                >
                  <ActionIcon
                    color={copied ? "teal" : "gray"}
                    variant="subtle"
                    onClick={copy}
                  >
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            {t(
              "Connect with your Docmost account via OAuth when your client supports it, or use an API key from your account settings.",
            )}
          </Text>

          <div>
            <Text size="sm" fw={500} mt="md" mb={4}>
              {t("Supported tools")}
            </Text>
            <List size="sm" spacing={2}>
              <List.Item>
                <Text size="sm" c="dimmed" span>
                  search_pages, get_page, create_page, update_page
                </Text>
              </List.Item>
              <List.Item>
                <Text size="sm" c="dimmed" span>
                  list_pages, list_child_pages, duplicate_page
                </Text>
              </List.Item>
              <List.Item>
                <Text size="sm" c="dimmed" span>
                  copy_page_to_space, move_page, move_page_to_space
                </Text>
              </List.Item>
              <List.Item>
                <Text size="sm" c="dimmed" span>
                  get_space, list_spaces, create_space, update_space
                </Text>
              </List.Item>
              <List.Item>
                <Text size="sm" c="dimmed" span>
                  get_comments, create_comment, update_comment
                </Text>
              </List.Item>
              <List.Item>
                <Text size="sm" c="dimmed" span>
                  search_attachments, list_workspace_members, get_current_user
                </Text>
              </List.Item>
            </List>
          </div>

          <div>
            <Text size="sm" fw={500} mt="md" mb={4}>
              {t("Trusted applications")}
            </Text>
            <Text size="sm" c="dimmed" mb="xs">
              {t(
                "Applications with these callback origins are trusted. Members will not see a warning when authorizing them.",
              )}
            </Text>

            {trustedClients.length > 0 && (
              <Table verticalSpacing="xs" mb="xs">
                <Table.Tbody>
                  {trustedClients.map((client) => (
                    <Table.Tr key={client.origin}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {client.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {client.origin}
                        </Text>
                      </Table.Td>
                      <Table.Td w={40}>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={t("Remove {{name}}", {
                            name: client.name,
                          })}
                          onClick={() =>
                            handleRemoveTrustedClient(client.origin)
                          }
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}

            <Group gap="xs">
              <TextInput
                value={newClientName}
                onChange={(event) =>
                  setNewClientName(event.currentTarget.value)
                }
                placeholder={t("Name")}
                aria-label={t("Trusted application name")}
                maxLength={64}
                style={{ flex: 1 }}
              />
              <TextInput
                value={newClientOrigin}
                onChange={(event) =>
                  setNewClientOrigin(event.currentTarget.value)
                }
                placeholder="https://app.yourcompany.com"
                aria-label={t("Trusted application origin")}
                style={{ flex: 2 }}
              />
              <Button
                variant="default"
                onClick={handleAddTrustedClient}
                disabled={!newClientName.trim() || !newClientOrigin.trim()}
              >
                {t("Add")}
              </Button>
            </Group>
          </div>
        </div>
      )}
    </Stack>
  );
}
