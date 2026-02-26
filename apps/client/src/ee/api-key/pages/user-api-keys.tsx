import React, { useState } from "react";
import { Anchor, Alert, Button, Group, Space, Text } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName, getAppUrl } from "@/lib/config";
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
  const mcpEnabled = workspace?.settings?.ai?.mcp === true;

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

  return (
    <>
      <Helmet>
        <title>
          {t("API keys")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("API keys")} />

      <Text size="sm" c="dimmed" mb="md">
        {t("View the")}{" "}
        <Anchor href="https://docmost.com/api-docs" target="_blank" size="sm">
          {t("API documentation")}
        </Anchor>{" "}
        {t("for usage details.")}
      </Text>

      {mcpEnabled && (
        <Alert variant="light" color="blue" mb="md" p="sm">
          <Text size="sm">
            {t(
              "Your workspace has MCP enabled. Use your API key to connect AI assistants.",
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
              {`${getAppUrl()}/api/mcp`}
            </Text>
          </Text>
        </Alert>
      )}

      <Group justify="flex-end" mb="md">
        <Button onClick={() => setCreateModalOpened(true)}>
          {t("Create API Key")}
        </Button>
      </Group>

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
