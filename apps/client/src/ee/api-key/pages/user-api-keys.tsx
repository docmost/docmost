import React, { useState } from "react";
import { Anchor, Alert, Button, Group, Space, Tabs, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { Trans, useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppUrl } from "@/lib/config";
import { ApiKeyTable } from "@/ee/api-key/components/api-key-table";
import { CreateApiKeyModal } from "@/ee/api-key/components/create-api-key-modal";
import { ApiKeyCreatedModal } from "@/ee/api-key/components/api-key-created-modal";
import { UpdateApiKeyModal } from "@/ee/api-key/components/update-api-key-modal";
import { RevokeApiKeyModal } from "@/ee/api-key/components/revoke-api-key-modal";
import Paginate from "@/components/common/paginate";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import { useGetApiKeysQuery } from "@/ee/api-key/queries/api-key-query.ts";
import { IApiKey } from "@/ee/api-key";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthorizedAppsPanel } from "@/ee/oauth/components/authorized-apps-panel.tsx";

export default function UserApiKeys() {
  const { t } = useTranslation();
  const { cursor, goNext, goPrev } = useCursorPaginate();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<IApiKey | null>(null);
  const [updateModalOpened, setUpdateModalOpened] = useState(false);
  const [revokeModalOpened, setRevokeModalOpened] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<IApiKey | null>(null);
  const { data, isLoading } = useGetApiKeysQuery({ cursor });
  const [workspace] = useAtom(workspaceAtom);
  const { isAdmin } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.endsWith("/authorized-apps")
    ? "authorized-apps"
    : "api-keys";
  const mcpEnabled = workspace?.settings?.ai?.mcp === true;
  const restrictToAdmins = workspace?.settings?.api?.restrictToAdmins === true;
  const canCreate = !restrictToAdmins || isAdmin;

  const handleCreateSuccess = (response: IApiKey) => {
    setCreatedApiKey(response);
  };

  const handleUpdate = (apiKey: IApiKey) => {
    setSelectedApiKey(apiKey);
    setUpdateModalOpened(true);
  };

  const handleRevoke = (apiKey: IApiKey) => {
    setSelectedApiKey(apiKey);
    setRevokeModalOpened(true);
  };

  const handleTabChange = (value: string | null) => {
    navigate(
      value === "authorized-apps"
        ? "/settings/account/api-keys/authorized-apps"
        : "/settings/account/api-keys",
    );
  };

  return (
    <>
      <DocumentTitle
        title={activeTab === "authorized-apps" ? t("Authorized apps") : t("API keys")}
      />

      <SettingsTitle title={t("API keys")} />

      {mcpEnabled && (
        <Alert variant="light" color="blue" mb="md" p="sm" icon={<IconInfoCircle />}>
          <Text size="sm">
            {t(
              "Your workspace has MCP enabled. Connect AI assistants with your Docmost account via OAuth.",
            )}{" "}
            <Anchor
              href="https://docmost.com/docs/user-guide/mcp"
              target="_blank"
              size="sm"
            >
              {t("Learn more")}
            </Anchor>
          </Text>
          <Text size="sm" mt={4}>
            {t("MCP server URL:")}{" "}
            <Text size="sm" fw={500} span ff="monospace">
              {`${getAppUrl()}/mcp`}
            </Text>
          </Text>
        </Alert>
      )}

      <Tabs color="dark" value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab fw={500} value="api-keys">
            {t("API keys")}
          </Tabs.Tab>
          <Tabs.Tab fw={500} value="authorized-apps">
            {t("Authorized apps")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="api-keys" pt="md">

        <Group justify="space-between" align="center" mb="md">
          <Text size="sm" c="dimmed">
            <Trans
              i18nKey="View the <anchor>API documentation</anchor> for usage details."
              components={{
                anchor: <Anchor href="https://docmost.com/api-docs" target="_blank" size="sm" />,
              }}
            />
          </Text>

          {canCreate && (
            <Button
              onClick={() => setCreateModalOpened(true)}
              style={{ flexShrink: 0 }}
            >
              {t("Create API Key")}
            </Button>
          )}
        </Group>

        {!canCreate && restrictToAdmins && (
          <Alert variant="light" color="yellow" mb="md" p="sm" icon={<IconInfoCircle />}>
            <Text size="sm">
              {t("API key creation is restricted to admins by your workspace administrator.")}
            </Text>
          </Alert>
        )}

        <ApiKeyTable
          apiKeys={data?.items || []}
          isLoading={isLoading}
          onUpdate={handleUpdate}
          onRevoke={handleRevoke}
        />

        <Space h="md" />

        {data?.items.length > 0 && (
          <Paginate
            hasPrevPage={data?.meta?.hasPrevPage}
            hasNextPage={data?.meta?.hasNextPage}
            onNext={() => goNext(data?.meta?.nextCursor)}
            onPrev={goPrev}
          />
        )}

        </Tabs.Panel>

        <Tabs.Panel value="authorized-apps" pt="md">
          <AuthorizedAppsPanel />
        </Tabs.Panel>
      </Tabs>

      <CreateApiKeyModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        onSuccess={handleCreateSuccess}
      />

      <ApiKeyCreatedModal
        opened={!!createdApiKey}
        onClose={() => setCreatedApiKey(null)}
        apiKey={createdApiKey}
      />

      <UpdateApiKeyModal
        opened={updateModalOpened}
        onClose={() => {
          setUpdateModalOpened(false);
          setSelectedApiKey(null);
        }}
        apiKey={selectedApiKey}
      />

      <RevokeApiKeyModal
        opened={revokeModalOpened}
        onClose={() => {
          setRevokeModalOpened(false);
          setSelectedApiKey(null);
        }}
        apiKey={selectedApiKey}
      />
    </>
  );
}
