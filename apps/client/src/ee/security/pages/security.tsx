import { Helmet } from "react-helmet-async";
import { getAppName, isCloud } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { Alert, Button, Card, Divider, Group, Space, Title } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import React, { useState } from "react";
import useUserRole from "@/hooks/use-user-role.tsx";
import SsoProviderList from "@/ee/security/components/sso-provider-list.tsx";
import CreateSsoProvider from "@/ee/security/components/create-sso-provider.tsx";
import EnforceSso from "@/ee/security/components/enforce-sso.tsx";
import AllowedDomains from "@/ee/security/components/allowed-domains.tsx";
import { useTranslation } from "react-i18next";
import EnforceMfa from "@/ee/security/components/enforce-mfa.tsx";
import DisablePublicSharing from "@/ee/security/components/disable-public-sharing.tsx";
import TrashRetention from "@/ee/security/components/trash-retention.tsx";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useGetScimTokensQuery } from "@/ee/scim/queries/scim-token-query";
import { ScimUrlPanel } from "@/ee/scim/components/scim-url-panel";
import { ScimTokenTable } from "@/ee/scim/components/scim-token-table";
import { CreateScimTokenModal } from "@/ee/scim/components/create-scim-token-modal";
import { ScimTokenCreatedModal } from "@/ee/scim/components/scim-token-created-modal";
import { RevokeScimTokenModal } from "@/ee/scim/components/revoke-scim-token-modal";
import EnableScim from "@/ee/scim/components/enable-scim";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import Paginate from "@/components/common/paginate";
import { IScimToken } from "@/ee/scim/types/scim-token.types";

export default function Security() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const hasCustomSso = useHasFeature(Feature.SSO_CUSTOM);
  const hasScim = useHasFeature(Feature.SCIM);
  const [workspace] = useAtom(workspaceAtom);
  const isScimEnabled = workspace?.isScimEnabled ?? false;

  const { cursor, goNext, goPrev } = useCursorPaginate();
  const { data: scimData, isLoading: scimLoading } = useGetScimTokensQuery(
    hasScim && isScimEnabled ? { cursor } : undefined,
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<IScimToken | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<IScimToken | null>(null);

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Security - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title={t("Security")} />

      <EnforceMfa />

      <Divider my="lg" />

      <DisablePublicSharing />
      <Divider my="lg" />

      <TrashRetention />
      <Divider my="lg" />

      <Title order={4} my="lg">
        {t("Single sign-on (SSO)")}
      </Title>

      <EnforceSso />
      <Divider my="lg" />

      {(isCloud() || hasCustomSso) && (
        <>
          <AllowedDomains />
          <Divider my="lg" />
        </>
      )}

      {hasCustomSso && (
        <>
          <CreateSsoProvider />
          <Divider size={0} my="lg" />
        </>
      )}

      <SsoProviderList />

      {hasScim && (
        <>
          <Divider my="xl" />

          <Title order={4} my="lg">
            {t("SCIM provisioning")}
          </Title>

          <Alert
            icon={<IconInfoCircle size={16} />}
            color="blue"
            variant="light"
            mb="md"
          >
            {t("SCIM takes precedence over SSO group sync while enabled.")}
          </Alert>

          <EnableScim />

          <Divider my="lg" />

          <ScimUrlPanel />

          {isScimEnabled && (
            <>
              <Divider my="lg" />

              <Group justify="space-between" mb="md">
                <Title order={5}>{t("SCIM tokens")}</Title>
                <Button onClick={() => setCreateOpen(true)}>
                  {t("Create SCIM token")}
                </Button>
              </Group>

              <Card shadow="sm" radius="sm">
                <ScimTokenTable
                  tokens={scimData?.items}
                  isLoading={scimLoading}
                  onRevoke={setRevokeTarget}
                />
              </Card>

              <Space h="md" />

              {scimData?.items.length > 0 && (
                <Paginate
                  hasPrevPage={scimData?.meta?.hasPrevPage}
                  hasNextPage={scimData?.meta?.hasNextPage}
                  onNext={() => goNext(scimData?.meta?.nextCursor)}
                  onPrev={goPrev}
                />
              )}

              <CreateScimTokenModal
                opened={createOpen}
                onClose={() => setCreateOpen(false)}
                onSuccess={setCreatedToken}
              />

              <ScimTokenCreatedModal
                opened={!!createdToken}
                onClose={() => setCreatedToken(null)}
                scimToken={createdToken}
              />

              <RevokeScimTokenModal
                opened={!!revokeTarget}
                onClose={() => setRevokeTarget(null)}
                scimToken={revokeTarget}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
