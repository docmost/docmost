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
import useLicense from "@/ee/hooks/use-license.tsx";

export default function Security() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { hasLicenseKey } = useLicense();

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Security - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title={t("Security")} />

      <AllowedDomains />

      <Divider my="lg" />

      <Title order={4} my="lg">
        Single sign-on (SSO)
      </Title>

      {/*TODO: revisit when we add a second plan */}
      {!isCloud() && hasLicenseKey ? (
        <>
          <EnforceSso />
          <Divider my="lg" />
          <CreateSsoProvider />
          <Divider size={0} my="lg" />
        </>
      ) : null}

      <SsoProviderList />
    </>
  );
}
