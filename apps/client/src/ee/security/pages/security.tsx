import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { Divider, Title } from "@mantine/core";
import React from "react";
import useUserRole from "@/hooks/use-user-role.tsx";
import SsoProviderList from "@/ee/security/components/sso-provider-list.tsx";
import CreateSsoProvider from "@/ee/security/components/create-sso-provider.tsx";
import EnforceSso from "@/ee/security/components/enforce-sso.tsx";
import AllowedDomains from "@/ee/security/components/allowed-domains.tsx";
import { useTranslation } from "react-i18next";
import usePlan from "@/ee/hooks/use-plan.tsx";

export default function Security() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { isStandard } = usePlan();

  // if is not cloud or enterprise return null
  //{(isCloud() || isEnterprise()) && (

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

      <EnforceSso />

      <Divider my="lg" />

      {!isStandard && <CreateSsoProvider />}

      <Divider size={0} my="lg" />

      <SsoProviderList />
    </>
  );
}
