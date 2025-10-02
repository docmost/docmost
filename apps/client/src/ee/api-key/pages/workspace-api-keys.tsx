import React, { useState } from "react";
import { Space } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import { ApiKeyTable } from "@/ee/api-key/components/api-key-table";
import { RevokeApiKeyModal } from "@/ee/api-key/components/revoke-api-key-modal";
import Paginate from "@/components/common/paginate";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search";
import { useGetApiKeysQuery } from "@/ee/api-key/queries/api-key-query.ts";
import { IApiKey } from "@/ee/api-key";
import useUserRole from '@/hooks/use-user-role.tsx';

export default function WorkspaceApiKeys() {
  const { t } = useTranslation();
  const { page, setPage } = usePaginateAndSearch();
  const [revokeModalOpened, setRevokeModalOpened] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<IApiKey | null>(null);
  const { data, isLoading } = useGetApiKeysQuery({ page, adminView: true });
  const { isAdmin } = useUserRole();

  if (!isAdmin) {
    return null;
  }

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

      <ApiKeyTable
        apiKeys={data?.items}
        isLoading={isLoading}
        showUserColumn
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
