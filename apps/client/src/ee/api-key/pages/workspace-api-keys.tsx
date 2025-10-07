import React, { useState } from "react";
import { Button, Group, Space, Text } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import { ApiKeyTable } from "@/ee/api-key/components/api-key-table";
import { CreateApiKeyModal } from "@/ee/api-key/components/create-api-key-modal";
import { ApiKeyCreatedModal } from "@/ee/api-key/components/api-key-created-modal";
import { UpdateApiKeyModal } from "@/ee/api-key/components/update-api-key-modal";
import { RevokeApiKeyModal } from "@/ee/api-key/components/revoke-api-key-modal";
import Paginate from "@/components/common/paginate";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search";
import { useGetApiKeysQuery } from "@/ee/api-key/queries/api-key-query.ts";
import { IApiKey } from "@/ee/api-key";
import useUserRole from '@/hooks/use-user-role.tsx';

export default function WorkspaceApiKeys() {
  const { t } = useTranslation();
  const { page, setPage } = usePaginateAndSearch();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<IApiKey | null>(null);
  const [updateModalOpened, setUpdateModalOpened] = useState(false);
  const [revokeModalOpened, setRevokeModalOpened] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<IApiKey | null>(null);
  const { data, isLoading } = useGetApiKeysQuery({ page, adminView: true });
  const { isAdmin } = useUserRole();

  if (!isAdmin) {
    return null;
  }

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
          {t("API management")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("API management")} />

      <Text size="md" c="dimmed" mb="md">
        {t("Manage API keys for all users in the workspace")}
      </Text>

      <Group justify="flex-end" mb="md">
        <Button onClick={() => setCreateModalOpened(true)}>
          {t("Create API Key")}
        </Button>
      </Group>

      <ApiKeyTable
        apiKeys={data?.items}
        isLoading={isLoading}
        showUserColumn
        onUpdate={handleUpdate}
        onRevoke={handleRevoke}
      />

      <Space h="md" />

      {data?.items.length > 0 && (
        <Paginate
          currentPage={page}
          hasPrevPage={data?.meta.hasPrevPage}
          hasNextPage={data?.meta.hasNextPage}
          onPageChange={setPage}
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
