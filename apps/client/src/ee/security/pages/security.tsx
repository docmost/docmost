import { Helmet } from "react-helmet-async";
import { getAppName, isCloud } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import {
  Alert,
  Button,
  Card,
  Divider,
  Group,
  Space,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
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
import { UpdateScimTokenModal } from "@/ee/scim/components/update-scim-token-modal";
import EnableScim from "@/ee/scim/components/enable-scim";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import Paginate from "@/components/common/paginate";
import { IScimToken } from "@/ee/scim/types/scim-token.types";
import FeatureStatus from "@/ee/security/components/feature-status.tsx";

const SCIM_TOKEN_LIMIT = 5;

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
  const [updateTarget, setUpdateTarget] = useState<IScimToken | null>(null);
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

      <Alert
        icon={<IconInfoCircle size={16} />}
        color="yellow"
        variant="light"
        mb="lg"
      >
        <Text size="sm" fw={600} mb={4}>
          Configurações da edição Enterprise do Docmost
        </Text>
        <Text size="sm">
          Nesta instância, só <b>Retenção da lixeira</b> e{" "}
          <b>Desativar compartilhamento público</b> funcionam de verdade. Os
          demais controles aparecem, mas o motor no servidor (módulo <code>ee</code>)
          não está incluído neste build — salvar não terá efeito.{" "}
          <b>Não ative o "Exigir MFA": ele não força o segundo fator</b> (login
          passa direto). Status e pendências em{" "}
          <code>docs/ee-feature-status.md</code>.
        </Text>
      </Alert>

      <FeatureStatus
        status="insecure"
        note="Exigiria autenticação em dois fatores (MFA/TOTP) no login. O motor de MFA está no módulo ee ausente: ligar o toggle grava a flag, mas o login NÃO valida o segundo fator. Mantenha desligado."
      />
      <EnforceMfa />

      <Divider my="lg" />

      <FeatureStatus
        status="working"
        note="Bloqueia a criação de links de compartilhamento público no workspace (e remove os existentes ao ativar). Enforçado no servidor — funciona."
      />
      <DisablePublicSharing />
      <Divider my="lg" />

      <FeatureStatus
        status="working"
        note="Define por quantos dias páginas na lixeira são mantidas antes da limpeza automática. Job de limpeza roda no servidor — funciona."
      />
      <TrashRetention />
      <Divider my="lg" />

      <Title order={4} my="lg">
        {t("Single sign-on (SSO)")}
      </Title>

      <FeatureStatus
        status="partial"
        note="SSO do Google Workspace funciona via variáveis de ambiente (GOOGLE_SSO_*). Provedores SSO customizados (SAML/OIDC/LDAP) abaixo são indisponíveis: os endpoints /sso/* estão no módulo ee ausente e retornam 404."
      />

      <EnforceSso />
      <Divider my="lg" />

      {(isCloud() || hasCustomSso) && (
        <>
          <FeatureStatus
            status="unavailable"
            note="Restringe o SSO a domínios de e-mail específicos. Depende do SSO customizado (indisponível nesta edição)."
          />
          <AllowedDomains />
          <Divider my="lg" />
        </>
      )}

      {hasCustomSso && (
        <>
          <FeatureStatus
            status="unavailable"
            note="Cadastro de provedores SSO customizados (SAML/OIDC/LDAP). O backend /sso/create|providers|update|delete não existe neste build — as chamadas dão 404."
          />
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

          <FeatureStatus
            status="unavailable"
            note="Provisionamento automático de usuários/grupos via SCIM. Não há endpoints /scim neste build — habilitar grava a flag, mas nada é provisionado."
          />

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
                <Tooltip
                  label={t(
                    "You have reached the maximum of {{max}} SCIM tokens. Delete an existing token to create a new one.",
                    { max: SCIM_TOKEN_LIMIT },
                  )}
                  disabled={(scimData?.items.length ?? 0) < SCIM_TOKEN_LIMIT}
                >
                  <Button
                    onClick={() => setCreateOpen(true)}
                    disabled={(scimData?.items.length ?? 0) >= SCIM_TOKEN_LIMIT}
                  >
                    {t("Create {{credential}}", {
                      credential: t("SCIM token"),
                    })}
                  </Button>
                </Tooltip>
              </Group>

              <Card shadow="sm" radius="sm">
                <ScimTokenTable
                  tokens={scimData?.items}
                  isLoading={scimLoading}
                  onUpdate={setUpdateTarget}
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

              <UpdateScimTokenModal
                opened={!!updateTarget}
                onClose={() => setUpdateTarget(null)}
                scimToken={updateTarget}
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
