import { Helmet } from "react-helmet-async";
import { getAppName, isCloud } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { Divider, Title } from "@mantine/core";
import React from "react";
import useUserRole from "@/hooks/use-user-role.tsx";
import SsoProviderList from "@/ee/security/components/sso-provider-list.tsx";
import CreateSsoProvider from "@/ee/security/components/create-sso-provider.tsx";
import EnforceSso from "@/ee/security/components/enforce-sso.tsx";
import AllowedDomains from "@/ee/security/components/allowed-domains.tsx";
import { useTranslation } from "react-i18next";
import EnforceMfa from "@/ee/security/components/enforce-mfa.tsx";
import DisablePublicSharing from "@/ee/security/components/disable-public-sharing.tsx";
import useEnterpriseAccess from "@/ee/hooks/use-enterprise-access.tsx";
import { useIsCloudEE } from "@/hooks/use-is-cloud-ee.tsx";

export default function Security() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const hasEnterpriseAccess = useEnterpriseAccess();
  const isCloudEE = useIsCloudEE();

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

      {(!isCloud() || hasEnterpriseAccess) && (
        <>
          <DisablePublicSharing />
          <Divider my="lg" />
        </>
      )}

      <Title order={4} my="lg">
        Single sign-on (SSO)
      </Title>

      {hasEnterpriseAccess && (
        <>
          <EnforceSso />
          <Divider my="lg" />
        </>
      )}

      {isCloudEE && (
        <>
          <AllowedDomains />
          <Divider my="lg" />
        </>
      )}

      {hasEnterpriseAccess && (
        <>
          <CreateSsoProvider />
          <Divider size={0} my="lg" />
        </>
      )}

      <SsoProviderList />
    </>
  );
}
